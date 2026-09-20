import type { Release, ReleaseStatus } from './release'

/** The `public.releases` row shape, as Postgres returns it. */
export interface ReleaseRow {
  id: string
  version: string
  release_date: string
  status: ReleaseStatus
  release_notes: string[] | null
  internal_notes: string | null
  published_to_website: boolean
  published_at: string | null
}

export function rowToRelease(row: ReleaseRow): Release {
  return {
    id: row.id,
    version: row.version,
    releaseDate: row.release_date,
    status: row.status,
    releaseNotes: row.release_notes ?? [],
    internalNotes: row.internal_notes ?? '',
    publishedToWebsite: row.published_to_website,
    publishedAt: row.published_at,
  }
}
