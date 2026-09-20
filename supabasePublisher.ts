import type { PublicRelease } from './release'
import type { PublishReceipt, UpdateLogEntry, WebsitePublisher } from './publishing'
import { PublishError } from './publishing'
import { getSupabase } from './supabaseClient'

interface UpdateLogRow {
  release_id: string
  version: string
  release_date: string
  notes: string[] | null
  published_at: string
}

/**
 * Publishes to `public.website_update_log` — the table the vClyps site reads.
 *
 * That table has no column for internal notes, so this publisher could not
 * leak them even if it tried. Swap in `HttpWebsitePublisher` by setting a
 * website API base URL in Settings once the real endpoints exist.
 */
export class SupabaseWebsitePublisher implements WebsitePublisher {
  readonly targetLabel = 'Supabase update log'

  async publish(release: PublicRelease): Promise<PublishReceipt> {
    if (release.notes.length === 0) {
      throw new PublishError('Add at least one release note before publishing.')
    }

    const publishedAt = new Date().toISOString()
    const { error } = await getSupabase()
      .from('website_update_log')
      .upsert(
        {
          release_id: release.id,
          version: release.version,
          release_date: release.releaseDate,
          notes: release.notes,
          published_at: publishedAt,
        },
        { onConflict: 'release_id' },
      )

    if (error) throw new PublishError(error.message)
    return { publishedAt }
  }

  async unpublish(releaseId: string): Promise<void> {
    const { error } = await getSupabase()
      .from('website_update_log')
      .delete()
      .eq('release_id', releaseId)

    if (error) throw new PublishError(error.message)
  }

  async getUpdateLog(): Promise<UpdateLogEntry[]> {
    const { data, error } = await getSupabase()
      .from('website_update_log')
      .select('release_id, version, release_date, notes, published_at')
      .order('release_date', { ascending: false })

    if (error) throw new PublishError(error.message)

    return (data as UpdateLogRow[]).map((row) => ({
      id: row.release_id,
      version: row.version,
      releaseDate: row.release_date,
      notes: row.notes ?? [],
      publishedAt: row.published_at,
    }))
  }
}
