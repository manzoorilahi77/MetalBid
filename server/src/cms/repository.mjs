/* ---------------------------------------------------------------------------
   CMS repository — Phase 24.

   The ONLY file under src/cms/ that touches `pool` or writes SQL. Every
   function here is a direct lift of a query that used to live inline in
   src/api/cms.mjs — same text, same pool.query vs pool.execute choice, same
   transaction boundaries. service.mjs is the only caller; nothing here knows
   about HTTP, auth, or the no-figures rule.
--------------------------------------------------------------------------- */
import { pool } from '../db.mjs'

/* ================================ reads ==================================== */

export async function findEnabledSections(pageRoute, role) {
  const [sections] = await pool.execute(
    `SELECT section_key, title, description, source_class, sort_order, toggleable, locked_reason
       FROM section_registry
      WHERE page_route = ?
        AND enabled = 1
        AND role IN ('*', ?)
      ORDER BY sort_order, section_key`,
    [pageRoute, role ?? '*'])
  return sections
}

export async function findPublishedBlocks(pageKey, sectionKeys) {
  const [blocks] = await pool.query(
    `SELECT section_key, block_key, kind, published_value, sort_order
       FROM cms_block
      WHERE page_key = ?
        AND status = 'published'
        AND published_value IS NOT NULL
        AND section_key IN (${sectionKeys.map(() => '?').join(',')})
      ORDER BY sort_order, block_key`,
    [pageKey, ...sectionKeys])
  return blocks
}

export async function findSections({ route = null, role = null }) {
  const where = []
  const params = []
  if (route) { where.push('page_route = ?'); params.push(route) }
  if (role) { where.push("role IN ('*', ?)"); params.push(role) }

  const [rows] = await pool.query(
    `SELECT * FROM section_registry
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY page_route, sort_order, section_key
      LIMIT 2000`, params)
  return rows
}

export async function findBlocks({ pageKey = null, status = null }) {
  const where = []
  const params = []
  if (pageKey) { where.push('page_key = ?'); params.push(pageKey) }
  if (status) { where.push('status = ?'); params.push(status) }

  const [rows] = await pool.query(
    `SELECT id, page_key, section_key, block_key, kind, locale, draft_value, published_value,
            status, version, authored_by, published_by, signed_by, note, sort_order,
            updated_at, published_at
       FROM cms_block
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY page_key, section_key, sort_order, block_key
      LIMIT 1000`, params)
  return rows
}

export async function findBlockByCoordinates({ pageKey, sectionKey, blockKey, locale }) {
  const [[row]] = await pool.query(
    `SELECT * FROM cms_block
      WHERE page_key = ? AND section_key = ? AND block_key = ? AND locale = ? LIMIT 1`,
    [pageKey, sectionKey, blockKey, locale])
  return row
}

export async function findBlockById(id) {
  const [[row]] = await pool.query('SELECT * FROM cms_block WHERE id = ? LIMIT 1', [id])
  return row
}

export async function findSectionReviewFlag({ sectionKey, pageRoute }) {
  const [[row]] = await pool.query(
    `SELECT review_required FROM section_registry
      WHERE section_key = ? AND page_route = ? LIMIT 1`,
    [sectionKey, pageRoute])
  return row
}

export async function findVersionSnapshot({ blockId, version }) {
  const [[row]] = await pool.query(
    'SELECT value FROM cms_block_versions WHERE block_id = ? AND version = ? LIMIT 1', [blockId, version])
  return row
}

export async function findSectionForToggle({ pageRoute, sectionKey, role }) {
  const [[row]] = await pool.query(
    `SELECT * FROM section_registry
      WHERE page_route = ? AND section_key = ? AND role = ? LIMIT 1`,
    [pageRoute, sectionKey, role ?? '*'])
  return row
}

export async function countPendingDrafts({ pageKey, sectionKey }) {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS n FROM cms_block
      WHERE page_key = ? AND section_key = ?
        AND status IN ('draft', 'in_review', 'ceo_pending')
        AND draft_value IS NOT NULL`,
    [pageKey, sectionKey])
  return row
}

export async function findChanges({ target = null, targetId = null, limit = 100 }) {
  const where = []
  const params = []
  if (target) { where.push('target = ?'); params.push(target) }
  if (targetId) { where.push('target_id = ?'); params.push(targetId) }

  const [rows] = await pool.query(
    `SELECT * FROM content_change_log
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY at DESC LIMIT ?`,
    [...params, Math.min(Number(limit) || 100, 500)])
  return rows
}

/* ================================ writes ==================================== */

export async function insertBlockDraft({ id, pageKey, sectionKey, blockKey, kind, locale, valueJson, authorId, sortOrder, now }) {
  await pool.execute(
    `INSERT INTO cms_block
       (id, page_key, section_key, block_key, kind, locale, draft_value, status,
        authored_by, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
    [id, pageKey, sectionKey, blockKey, kind, locale, valueJson, authorId, sortOrder, now, now])
}

export async function updateBlockDraft({ id, valueJson, kind, sortOrder, authorId, now }) {
  await pool.execute(
    `UPDATE cms_block
        SET draft_value = ?, kind = ?, sort_order = ?, status = 'draft',
            authored_by = ?, note = NULL, updated_at = ?
      WHERE id = ?`,
    [valueJson, kind, sortOrder, authorId, now, id])
}

export async function markBlockCeoPending({ id, note, now }) {
  await pool.execute(
    `UPDATE cms_block SET status = 'ceo_pending', note = ?, updated_at = ? WHERE id = ?`,
    [note, now, id])
}

/** Publish transaction: the draft becomes the published value at the next
 *  version, and that version is archived. Atomic — both writes or neither. */
export async function publishBlockTx({ id, version, publishedBy, signedBy, now, note, versionValueJson, versionId }) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(
      `UPDATE cms_block
          SET published_value = draft_value, status = 'published', version = ?,
              published_by = ?, signed_by = ?, published_at = ?, updated_at = ?, note = ?
        WHERE id = ?`,
      [version, publishedBy, signedBy, now, now, note, id])
    await conn.execute(
      `INSERT INTO cms_block_versions (id, block_id, version, value, published_by, signed_by, published_at, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [versionId, id, version, versionValueJson, publishedBy, signedBy, now, note])
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export async function markBlockUnpublished({ id, now, reason }) {
  await pool.execute(
    `UPDATE cms_block SET published_value = NULL, status = 'draft', updated_at = ?, note = ? WHERE id = ?`,
    [now, reason, id])
}

/** Rollback transaction: restore a prior version's value as a new version, so
 *  history reads forwards. Atomic — both writes or neither. */
export async function rollbackBlockTx({ id, next, publishedBy, now, target, valueJson, versionId }) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(
      `UPDATE cms_block
          SET published_value = ?, draft_value = ?, status = 'published', version = ?,
              published_by = ?, published_at = ?, updated_at = ?, note = ?
        WHERE id = ?`,
      [valueJson, valueJson, next, publishedBy, now, now, `Rolled back to version ${target}`, id])
    await conn.execute(
      `INSERT INTO cms_block_versions (id, block_id, version, value, published_by, published_at, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [versionId, id, next, valueJson, publishedBy, now, `Rolled back to version ${target}`])
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export async function markBlockReturned({ id, note, now }) {
  await pool.execute(
    `UPDATE cms_block SET status = 'returned', note = ?, updated_at = ? WHERE id = ?`,
    [note, now, id])
}

export async function updateSectionEnabled({ pageRoute, sectionKey, role, enabled, updatedBy, now }) {
  await pool.execute(
    `UPDATE section_registry
        SET enabled = ?, updated_by = ?, updated_at = ?
      WHERE page_route = ? AND section_key = ? AND role = ?`,
    [enabled, updatedBy, now, pageRoute, sectionKey, role ?? '*'])
}

/** Reorders every section on a page in one transaction — either the whole
 *  page's order lands, or none of it does. */
export async function reorderSectionsTx({ route, order, updatedBy, now }) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    for (const [i, key] of order.entries()) {
      await conn.execute(
        `UPDATE section_registry SET sort_order = ?, updated_by = ?, updated_at = ?
          WHERE page_route = ? AND section_key = ?`,
        [i, updatedBy, now, route, key])
    }
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export async function upsertSection(row, updatedBy, now) {
  await pool.execute(
    `INSERT INTO section_registry
       (section_key, page_route, role, title, description, source_class, enabled, toggleable,
        locked_reason, review_required, sort_order, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       title = VALUES(title), description = VALUES(description),
       source_class = VALUES(source_class), toggleable = VALUES(toggleable),
       locked_reason = VALUES(locked_reason), review_required = VALUES(review_required),
       sort_order = VALUES(sort_order), updated_by = VALUES(updated_by), updated_at = VALUES(updated_at)`,
    [row.section_key, row.page_route, row.role, row.title, row.description, row.source_class,
     row.enabled, row.toggleable, row.locked_reason, row.review_required, row.sort_order,
     updatedBy, now])
}

export async function insertChangeLog(row) {
  await pool.execute(
    `INSERT INTO content_change_log
       (id, target, target_id, action, before_json, after_json, actor_id, actor_role, reason, at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.target, row.targetId, row.action, row.beforeJson, row.afterJson,
     row.actorId, row.actorRole, row.reason, row.at])
}
