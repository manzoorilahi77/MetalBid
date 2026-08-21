/* ---------------------------------------------------------------------------
   The CMS, from the editor's side.

   Thin wrappers over /api/cms. They exist so the screens deal in one shape and
   one error convention, and so `invalidateCmsPage` is called in exactly one
   place after a publish — an author who cannot see their own change until they
   reload will assume the publish failed and press it again.
--------------------------------------------------------------------------- */
import { apiGet, apiPost, apiPatch, ApiError } from './client'
import { invalidateCmsPage } from './useCmsPage'

export interface AdminSection {
  key: string
  route: string
  role: string
  title: string
  description: string | null
  source: 'cms' | 'portal' | 'api' | 'live' | 'own'
  enabled: boolean
  toggleable: boolean
  lockedReason: string | null
  reviewRequired: boolean
  sortOrder: number
  updatedBy: string | null
  updatedAt: string | null
}

export type BlockStatus = 'draft' | 'in_review' | 'ceo_pending' | 'published' | 'returned'

export interface AdminBlock {
  id: string
  pageKey: string
  sectionKey: string
  blockKey: string
  kind: 'text' | 'richtext' | 'image' | 'link' | 'list' | 'faq' | 'number_label'
  locale: string
  draft: unknown
  published: unknown
  status: BlockStatus
  version: number
  authoredBy: string | null
  publishedBy: string | null
  signedBy: string | null
  note: string | null
  sortOrder: number
  updatedAt: string | null
  publishedAt: string | null
}

export interface ChangeEntry {
  id: string
  target: string
  targetId: string
  action: string
  before: unknown
  after: unknown
  actorId: string | null
  actorRole: string | null
  reason: string | null
  at: string
}

/** Every section on every route, including the ones switched off. */
export const listSections = (route?: string): Promise<AdminSection[]> =>
  apiGet<AdminSection[]>(`/api/cms/sections${route ? `?route=${encodeURIComponent(route)}` : ''}`)

export const listBlocks = (pageKey?: string): Promise<AdminBlock[]> =>
  apiGet<AdminBlock[]>(`/api/cms/blocks${pageKey ? `?pageKey=${encodeURIComponent(pageKey)}` : ''}`)

export const listChanges = (limit = 60): Promise<ChangeEntry[]> =>
  apiGet<ChangeEntry[]>(`/api/cms/changes?limit=${limit}`)

/** Turn a section on or off. Throws with the server's reason when it refuses —
 *  which for a locked section is the sentence the registry stores. */
export async function setSectionEnabled(
  section: Pick<AdminSection, 'route' | 'key' | 'role'>,
  enabled: boolean,
  reason?: string,
): Promise<void> {
  await apiPatch('/api/cms/sections/enabled', {
    route: section.route, sectionKey: section.key, role: section.role, enabled, reason,
  })
  invalidateCmsPage(section.route)
}

export async function saveBlock(input: {
  pageKey: string; sectionKey: string; blockKey: string
  kind: AdminBlock['kind']; value: unknown; sortOrder?: number
}): Promise<{ id: string }> {
  return apiPost<{ id: string }>('/api/cms/blocks', input)
}

export async function publishBlock(id: string, route: string, note?: string): Promise<{ status: BlockStatus; message?: string }> {
  const result = await apiPost<{ status: BlockStatus; message?: string }>(
    `/api/cms/blocks/${encodeURIComponent(id)}/publish`, { note })
  invalidateCmsPage(route)
  return result
}

export async function unpublishBlock(id: string, route: string, reason: string): Promise<void> {
  await apiPost(`/api/cms/blocks/${encodeURIComponent(id)}/unpublish`, { reason })
  invalidateCmsPage(route)
}

export async function rollbackBlock(id: string, route: string, version: number): Promise<void> {
  await apiPost(`/api/cms/blocks/${encodeURIComponent(id)}/rollback`, { version })
  invalidateCmsPage(route)
}

/** The message to show a user when a CMS call is refused. The server's wording
 *  is deliberate — a locked section explains itself, and the no-figures rule
 *  says what to do instead — so it is passed through rather than replaced. */
export const cmsErrorMessage = (err: unknown): string =>
  err instanceof ApiError ? err.message : 'Something went wrong — the change was not saved'

/* Route <-> page key, mirroring the map in the server's cms.mjs. The editor
   needs both: sections are keyed by route, blocks by page key. */
const ROUTE_TO_PAGE: Record<string, string> = {
  '/': 'home',
  '/legal/privacy': 'privacy',
  '/legal/terms': 'terms',
  '/pricing': 'pricing',
  '/about': 'about',
  '/contact': 'contact',
  '/blog': 'blog',
  '/knowledge': 'knowledge',
  '/help': 'help',
  '/help/faqs': 'faqs',
  '/grievance': 'grievance',
}

export const pageKeyFor = (route: string): string =>
  ROUTE_TO_PAGE[route] ?? (route.replace(/^\//, '').replace(/[/-]/g, '_') || 'home')

export const routeFor = (pageKey: string): string => {
  const found = Object.entries(ROUTE_TO_PAGE).find(([, key]) => key === pageKey)
  return found ? found[0] : `/${pageKey.replace(/_/g, '/')}`
}
