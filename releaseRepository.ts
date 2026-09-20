import type { Release, ReleaseInput, ReleaseStatus } from './release'
import { cleanReleaseNotes, normalizeVersion, sortReleases } from './release'
import { getSupabase } from './supabaseClient'
import { rowToRelease } from './releaseRow'
import type { ReleaseRow } from './releaseRow'

/**
 * Persistence contract for releases.
 *
 * These are granular operations rather than a bulk "save everything" call, so
 * two people editing different releases do not overwrite each other.
 */
export interface ReleaseRepository {
  list(): Promise<Release[]>
  create(input: ReleaseInput): Promise<Release>
  update(id: string, patch: Partial<ReleaseInput>): Promise<Release>
  /** Returns the whole list, since promoting one release demotes another. */
  setStatus(id: string, status: ReleaseStatus): Promise<Release[]>
  setPublished(id: string, publishedAt: string | null): Promise<Release>
  remove(id: string): Promise<void>
}

const COLUMNS = 'id, version, release_date, status, release_notes, internal_notes, published_to_website, published_at'

export class SupabaseReleaseRepository implements ReleaseRepository {
  async list(): Promise<Release[]> {
    const { data, error } = await getSupabase()
      .from('releases')
      .select(COLUMNS)
      .order('release_date', { ascending: false })

    if (error) throw new Error(describe(error.message))
    return sortReleases((data as ReleaseRow[]).map(rowToRelease))
  }

  async create(input: ReleaseInput): Promise<Release> {
    // An RPC, because creating a production release must demote the current
    // one in the same transaction.
    const { data, error } = await getSupabase().rpc('create_release', {
      p_version: normalizeVersion(input.version),
      p_release_date: input.releaseDate,
      p_status: input.status,
      p_release_notes: cleanReleaseNotes(input.releaseNotes),
      p_internal_notes: input.internalNotes.trim(),
    })

    if (error) throw new Error(describe(error.message))
    return rowToRelease(data as ReleaseRow)
  }

  async update(id: string, patch: Partial<ReleaseInput>): Promise<Release> {
    const row: Record<string, unknown> = {}
    if (patch.version !== undefined) row.version = normalizeVersion(patch.version)
    if (patch.releaseDate !== undefined) row.release_date = patch.releaseDate
    if (patch.releaseNotes !== undefined) row.release_notes = cleanReleaseNotes(patch.releaseNotes)
    if (patch.internalNotes !== undefined) row.internal_notes = patch.internalNotes

    const { data, error } = await getSupabase()
      .from('releases')
      .update(row)
      .eq('id', id)
      .select(COLUMNS)
      .single()

    if (error) throw new Error(describe(error.message))
    return rowToRelease(data as ReleaseRow)
  }

  async setStatus(id: string, status: ReleaseStatus): Promise<Release[]> {
    const { data, error } = await getSupabase().rpc('set_release_status', {
      p_id: id,
      p_status: status,
    })

    if (error) throw new Error(describe(error.message))
    return sortReleases((data as ReleaseRow[]).map(rowToRelease))
  }

  async setPublished(id: string, publishedAt: string | null): Promise<Release> {
    const { data, error } = await getSupabase()
      .from('releases')
      .update({ published_to_website: publishedAt !== null, published_at: publishedAt })
      .eq('id', id)
      .select(COLUMNS)
      .single()

    if (error) throw new Error(describe(error.message))
    return rowToRelease(data as ReleaseRow)
  }

  async remove(id: string): Promise<void> {
    const { error } = await getSupabase().from('releases').delete().eq('id', id)
    if (error) throw new Error(describe(error.message))
  }
}

/** Turns Postgres constraint errors into something a person can act on. */
function describe(message: string): string {
  if (message.includes('releases_version_key')) return 'That version already exists.'
  if (message.includes('releases_one_production')) {
    return 'Another release is already in production.'
  }
  if (message.includes('releases_status_check')) return 'That status is not allowed.'
  if (message.includes('Failed to fetch')) {
    return 'Could not reach Supabase. Check your connection and that the project is running.'
  }
  return message
}
