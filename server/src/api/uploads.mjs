/* ---------------------------------------------------------------------------
   File uploads.

   `lot_photos` stored a colour hue. Inspection photographs, KYC documents,
   deposit proofs and CMS media all needed somewhere real to live.

   Two decisions worth stating:

   * **Raw body, not multipart.** No multer, no busboy, no dependency: the
     client PUTs the bytes with `Content-Type` and an `X-Filename` header, which
     `fetch` does natively from a File object. Multipart exists to send several
     fields at once; here there is one file and the metadata fits in headers and
     the query string.

   * **The filename the client sends is never a path.** It is recorded for
     display and thrown away for storage — the file is stored under its own id
     with an extension derived from its *sniffed* type. That closes path
     traversal and the "upload .html, open it, own the origin" trick in one go,
     and the CSP in headers.mjs closes it again.

   Type is decided by looking at the first bytes, not by trusting the header. A
   client that says `image/jpeg` and sends HTML gets rejected.
--------------------------------------------------------------------------- */
import { createHash } from 'node:crypto'
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pool } from '../db.mjs'
import { toDbDateTime } from '../time.mjs'
import { newId } from '../auth/tokens.mjs'
import { env } from '../env.mjs'
import { hasRole, isStaff, BACK_OFFICE_ROLES, ADMIN_ROLES } from '../auth/roles.mjs'
import { oneOf, id as idField, str, invalid } from './validate.mjs'

const fail = (status, code, message) =>
  Object.assign(new Error(message), { status, code, expected: true })

export const UPLOAD_ROOT = resolve(env.UPLOAD_DIR ?? './var/uploads')

/** 15MB. A yard photograph from a phone is 3–8MB; a scanned KYC set is larger,
 *  and anything past this is a mistake or an attack. */
export const MAX_UPLOAD_BYTES = Number(env.MAX_UPLOAD_BYTES ?? 15 * 1024 * 1024)

/* What may be uploaded, and what it is for. `visibility` is the default for
   that kind — a lot photo is public because the catalogue is public; a KYC
   document is never public, whoever asks. */
const KINDS = {
  lot_photo:     { visibility: 'public',        roles: ['field_exec', 'exec_manager', 'seller', 'sub_admin'] },
  inspection:    { visibility: 'authenticated', roles: ['field_exec', 'exec_manager', 'sub_admin'] },
  kyc:           { visibility: 'staff',         roles: ['buyer', 'seller', 'sub_admin'] },
  deposit_proof: { visibility: 'owner',         roles: ['buyer', 'seller', 'finance_admin', 'sub_admin'] },
  dispute:       { visibility: 'owner',         roles: ['buyer', 'seller', 'sub_admin', 'exec_manager'] },
  cms_media:     { visibility: 'public',        roles: ['sub_admin'] },
}

/* Magic numbers. The list is short on purpose — every additional type is
   additional attack surface, and this platform needs photographs and PDFs. */
const SIGNATURES = [
  { mime: 'image/jpeg', ext: 'jpg',  test: (b) => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF },
  { mime: 'image/png',  ext: 'png',  test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 },
  { mime: 'image/webp', ext: 'webp', test: (b) => b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP' },
  { mime: 'application/pdf', ext: 'pdf', test: (b) => b.slice(0, 5).toString('ascii') === '%PDF-' },
]

/**
 * Read the body off the request with a hard byte cap.
 *
 * express.json() is not in this path — the route mounts this instead — so the
 * cap has to be enforced here, by counting as the chunks arrive and destroying
 * the socket the moment the limit is passed. Buffering first and checking after
 * is how a 2GB upload becomes a 2GB allocation.
 */
export function readBody(req, limit = MAX_UPLOAD_BYTES) {
  return new Promise((resolve_, reject) => {
    const chunks = []
    let total = 0
    req.on('data', (chunk) => {
      total += chunk.length
      if (total > limit) {
        reject(fail(413, 'too_large', `Files must be ${Math.floor(limit / 1024 / 1024)}MB or smaller`))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve_(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/**
 * Store one file.
 *
 * Deduplicated by content hash: the same photograph attached to two lots is one
 * file on disk and two rows.
 */
export async function storeUpload({ auth, kind, buffer, filename, entityType = null, entityId = null, altText = null }) {
  if (!auth) throw fail(401, 'unauthenticated', 'Sign in to upload')
  const k = oneOf(kind, 'kind', Object.keys(KINDS))
  const spec = KINDS[k]

  if (!hasRole(auth.role, spec.roles)) throw fail(403, 'forbidden', `Your role cannot upload ${k.replace('_', ' ')} files`)
  if (!buffer?.length) throw fail(400, 'empty', 'No file was sent')

  /* Sniff before trusting. */
  const signature = SIGNATURES.find((s) => s.test(buffer))
  if (!signature) {
    throw fail(415, 'unsupported_type',
      'Only JPEG, PNG, WebP and PDF files are accepted — the file sent is none of those')
  }

  const sha = createHash('sha256').update(buffer).digest('hex')
  const safeName = sanitiseFilename(filename) || `upload.${signature.ext}`

  /* Same bytes already on disk? Reuse the file, still write a new row: the two
     uploads may belong to different lots, owners or visibilities. */
  const [[twin]] = await pool.query(
    'SELECT storage_path FROM uploads WHERE sha256 = ? AND deleted_at IS NULL LIMIT 1', [sha])

  const id = newId('upl')
  let storagePath = twin?.storage_path
  if (!storagePath) {
    /* Sharded two levels by hash so no directory ends up with 100,000 entries —
       which is where ext4 and every backup tool start to struggle. */
    const dir = join(sha.slice(0, 2), sha.slice(2, 4))
    await mkdir(join(UPLOAD_ROOT, dir), { recursive: true })
    storagePath = join(dir, `${sha}.${signature.ext}`)
    await writeFile(join(UPLOAD_ROOT, storagePath), buffer, { flag: 'wx' })
      .catch((err) => { if (err.code !== 'EEXIST') throw err })
  }

  const dims = signature.mime.startsWith('image/') ? readDimensions(buffer, signature.mime) : {}

  await pool.execute(
    `INSERT INTO uploads
       (id, kind, visibility, owner_id, entity_type, entity_id, filename, mime, bytes,
        sha256, storage_path, width, height, alt_text, uploaded_by, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, k, spec.visibility, auth.userId, entityType, entityId, safeName, signature.mime,
     buffer.length, sha, storagePath.replace(/\\/g, '/'),
     dims.width ?? null, dims.height ?? null,
     altText ? String(altText).slice(0, 255) : null, auth.userId, toDbDateTime(new Date())])

  return {
    id, kind: k, filename: safeName, mime: signature.mime, bytes: buffer.length,
    width: dims.width ?? null, height: dims.height ?? null,
    url: `/api/uploads/${id}`,
  }
}

/**
 * Fetch a file, if the caller may see it.
 *
 * The visibility ladder is the point of this function:
 *   public         anybody
 *   authenticated  any signed-in account
 *   owner          the uploader, the entity's owner, or back office
 *   staff          back office only — KYC documents live here
 */
export async function readUpload({ auth, uploadId }) {
  const id = idField(uploadId, 'uploadId')
  const [[row]] = await pool.query(
    'SELECT * FROM uploads WHERE id = ? AND deleted_at IS NULL LIMIT 1', [id])
  if (!row) throw fail(404, 'not_found', 'No such file')

  const allowed =
    row.visibility === 'public' ? true
    : !auth ? false
    : row.visibility === 'authenticated' ? true
    : row.visibility === 'staff' ? hasRole(auth.role, BACK_OFFICE_ROLES)
    : /* owner */ row.owner_id === auth.userId || hasRole(auth.role, BACK_OFFICE_ROLES)

  /* 404 rather than 403 for a private file: confirming that an id exists is
     itself a disclosure when the ids are guessable. */
  if (!allowed) throw fail(404, 'not_found', 'No such file')

  const absolute = resolve(UPLOAD_ROOT, row.storage_path)
  /* Defence in depth: storage_path is generated, never client-supplied, but a
     path that escapes the root must never be served whatever put it there. */
  if (!absolute.startsWith(UPLOAD_ROOT)) throw fail(404, 'not_found', 'No such file')
  await stat(absolute).catch(() => { throw fail(410, 'gone', 'That file is no longer stored') })

  return {
    buffer: await readFile(absolute),
    mime: row.mime,
    filename: row.filename,
    /* Public files are immutable — the path is a content hash — so they cache
       forever. Everything else must not be cached by a shared proxy. */
    cacheControl: row.visibility === 'public'
      ? 'public, max-age=31536000, immutable'
      : 'private, no-store',
  }
}

/** Soft-delete. The bytes stay until a sweeper removes what nothing references —
 *  two rows may share one file, so deleting a row must not delete the file. */
export async function deleteUpload({ auth, uploadId }) {
  const id = idField(uploadId, 'uploadId')
  const [[row]] = await pool.query('SELECT * FROM uploads WHERE id = ? LIMIT 1', [id])
  if (!row) throw fail(404, 'not_found', 'No such file')

  const mayDelete = row.uploaded_by === auth?.userId || hasRole(auth?.role, ADMIN_ROLES)
  if (!mayDelete) throw fail(403, 'forbidden', 'You cannot delete this file')

  await pool.execute('UPDATE uploads SET deleted_at = ? WHERE id = ?',
    [toDbDateTime(new Date()), id])
  return { id, deleted: true }
}

/** What is attached to one record. */
export async function listUploads({ auth, entityType, entityId }) {
  const [rows] = await pool.query(
    `SELECT id, kind, visibility, filename, mime, bytes, width, height, alt_text, uploaded_at, owner_id
       FROM uploads
      WHERE entity_type = ? AND entity_id = ? AND deleted_at IS NULL
      ORDER BY uploaded_at`,
    [str(entityType, 'entityType', { max: 32 }), idField(entityId, 'entityId')])

  return rows
    .filter((r) => r.visibility === 'public'
      || (auth && (r.visibility === 'authenticated'
        || r.owner_id === auth.userId
        || isStaff(auth.role))))
    .map((r) => ({
      id: r.id, kind: r.kind, filename: r.filename, mime: r.mime, bytes: Number(r.bytes),
      width: r.width, height: r.height, altText: r.alt_text,
      uploadedAt: new Date(r.uploaded_at).toISOString(),
      url: `/api/uploads/${r.id}`,
    }))
}

/* -------------------------------- helpers -------------------------------- */

/** Keep something recognisable for display; keep nothing that is a path. */
function sanitiseFilename(name) {
  if (typeof name !== 'string') return null
  return name
    .replace(/[\\/]/g, '')          // no separators
    .replace(/\.{2,}/g, '.')        // no traversal
    .replace(/[^\w.\- ]/g, '')      // no control characters, quotes or wildcards
    .trim()
    .slice(0, 200) || null
}

/**
 * Width and height, read from the header bytes.
 *
 * Enough for PNG and JPEG, which is what a phone camera produces. Failing to
 * find them is not an error — the column is nullable, and a missing dimension
 * costs a layout hint, not a feature.
 */
function readDimensions(buffer, mime) {
  try {
    if (mime === 'image/png' && buffer.length > 24) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
    }
    if (mime === 'image/jpeg') {
      let i = 2
      while (i < buffer.length - 9) {
        if (buffer[i] !== 0xFF) { i += 1; continue }
        const marker = buffer[i + 1]
        /* SOF0..SOF3 and SOF5..SOF15 carry the frame size; skip the rest. */
        if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
          return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) }
        }
        i += 2 + buffer.readUInt16BE(i + 2)
      }
    }
  } catch { /* a truncated or unusual file — dimensions are optional */ }
  return {}
}

/** Called at boot so a missing directory fails loudly at startup rather than on
 *  the first upload three days later. */
export async function ensureUploadDir() {
  await mkdir(UPLOAD_ROOT, { recursive: true })
  return UPLOAD_ROOT
}
