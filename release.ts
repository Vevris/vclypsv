/**
 * Release domain model.
 *
 * This module is intentionally free of React, storage and network concerns so
 * the same rules apply no matter which repository or publisher is wired up.
 */

export type ReleaseStatus = 'production' | 'previous' | 'draft'

export interface Release {
  id: string
  version: string
  /** ISO calendar date, `YYYY-MM-DD`. Dates are days, not instants. */
  releaseDate: string
  status: ReleaseStatus
  /** Public bullet points. These are the only notes the website ever sees. */
  releaseNotes: string[]
  /** Never leaves this tool. */
  internalNotes: string
  publishedToWebsite: boolean
  /** ISO timestamp of the last successful publish, or null. */
  publishedAt: string | null
}

/** A release draft as entered by a person, before it becomes a `Release`. */
export type ReleaseInput = Omit<Release, 'id' | 'publishedToWebsite' | 'publishedAt'>

/**
 * The public projection of a release: exactly what the vClyps website is
 * allowed to receive. `internalNotes` is structurally absent, so it cannot be
 * leaked by forgetting to strip it at the call site.
 */
export interface PublicRelease {
  id: string
  version: string
  releaseDate: string
  notes: string[]
}

export const STATUS_LABELS: Record<ReleaseStatus, string> = {
  production: 'Production',
  previous: 'Previous',
  draft: 'Draft',
}

export const STATUS_ORDER: ReleaseStatus[] = ['production', 'previous', 'draft']

/* -------------------------------------------------------------------------- */
/* Version                                                                    */
/* -------------------------------------------------------------------------- */

export const VERSION_MAX_LENGTH = 32

/**
 * Version strings are user-controlled data. We deliberately do NOT enforce
 * semantic versioning: `v0.9`, `v1.0`, `v2.4.7` and `v1.0.0-rc.1` are all
 * equally valid. Validation only rejects input that is obviously broken.
 */
const VERSION_PATTERN = /^[vV]?\d+(\.\d+)*([.-][0-9A-Za-z.-]+)?$/

export function normalizeVersion(raw: string): string {
  return raw.trim().replace(/\s+/g, '')
}

export function validateVersion(
  raw: string,
  options: { existingVersions?: string[] } = {},
): string | null {
  const version = normalizeVersion(raw)

  if (version === '') return 'Version cannot be empty.'
  if (version.length > VERSION_MAX_LENGTH) {
    return `Version cannot be longer than ${VERSION_MAX_LENGTH} characters.`
  }
  if (!/\d/.test(version)) return 'Version must contain at least one number.'
  if (!VERSION_PATTERN.test(version)) {
    return 'Use numbers separated by dots, optionally prefixed with "v" (e.g. v1.0, v2.4.7, v1.0.0-rc.1).'
  }

  const clash = options.existingVersions?.some(
    (existing) => existing.toLowerCase() === version.toLowerCase(),
  )
  if (clash) return `${version} already exists.`

  return null
}

/* -------------------------------------------------------------------------- */
/* Bumping                                                                    */
/* -------------------------------------------------------------------------- */

export type BumpKind = 'major' | 'minor' | 'patch'

export const BUMP_LABELS: Record<BumpKind, string> = {
  major: 'Major',
  minor: 'Minor',
  patch: 'Patch',
}

export const BUMP_ORDER: BumpKind[] = ['major', 'minor', 'patch']

/**
 * Suggests the next version for a major/minor/patch bump.
 *
 * This is a convenience, not a rule: the result is only ever a suggestion that
 * lands in an editable field, so any version can still be typed by hand. Short
 * versions are padded to three parts (`v0.9` patches to `v0.9.1`) and a
 * pre-release suffix is dropped (`v1.0.0-rc.1` patches to `v1.0.1`).
 *
 * Returns null when the version has no numeric part to bump, in which case the
 * caller should offer manual entry only.
 */
export function bumpVersion(version: string, kind: BumpKind): string | null {
  const match = /^([vV]?)(\d+(?:\.\d+)*)/.exec(normalizeVersion(version))
  if (!match) return null

  const prefix = match[1] ?? ''
  const parts = (match[2] ?? '').split('.').map((part) => Number.parseInt(part, 10))
  while (parts.length < 3) parts.push(0)

  const [major = 0, minor = 0, patch = 0] = parts
  const next =
    kind === 'major'
      ? [major + 1, 0, 0]
      : kind === 'minor'
        ? [major, minor + 1, 0]
        : [major, minor, patch + 1]

  return `${prefix}${next.join('.')}`
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function validateReleaseDate(value: string): string | null {
  if (!ISO_DATE_PATTERN.test(value)) return 'Release date must be a valid date.'
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return 'Release date must be a valid date.'
  return null
}

/** `2026-09-19` -> `Sep 19, 2026`. Parsed as UTC so the day never shifts. */
export function formatReleaseDate(isoDate: string): string {
  if (!ISO_DATE_PATTERN.test(isoDate)) return isoDate
  const parsed = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}

export function formatTimestamp(iso: string | null): string {
  if (!iso) return '—'
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed)
}

export function todayIsoDate(now: Date = new Date()): string {
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

/* -------------------------------------------------------------------------- */
/* Notes                                                                      */
/* -------------------------------------------------------------------------- */

/** Drops blank bullets and trims the rest. */
export function cleanReleaseNotes(notes: string[]): string[] {
  return notes.map((note) => note.trim()).filter((note) => note.length > 0)
}

/* -------------------------------------------------------------------------- */
/* Projections and ordering                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The single place a `Release` becomes website-facing data. Internal notes are
 * dropped here, by construction.
 */
export function toPublicRelease(release: Release): PublicRelease {
  return {
    id: release.id,
    version: release.version,
    releaseDate: release.releaseDate,
    notes: cleanReleaseNotes(release.releaseNotes),
  }
}

/** Newest first; ties broken by status so the production build leads. */
export function sortReleases(releases: Release[]): Release[] {
  return [...releases].sort((a, b) => {
    if (a.releaseDate !== b.releaseDate) return a.releaseDate < b.releaseDate ? 1 : -1
    return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
  })
}

/** The release shown as "current" — the production one, if there is one. */
export function findCurrentRelease(releases: Release[]): Release | null {
  return sortReleases(releases).find((release) => release.status === 'production') ?? null
}

/**
 * Only one release can be in production at a time. Promoting one demotes the
 * previous production release rather than leaving two live versions.
 */
export function applyStatusChange(
  releases: Release[],
  id: string,
  status: ReleaseStatus,
): Release[] {
  return releases.map((release) => {
    if (release.id === id) return { ...release, status }
    if (status === 'production' && release.status === 'production') {
      return { ...release, status: 'previous' }
    }
    return release
  })
}

export function createId(): string {
  const globalCrypto = globalThis.crypto
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return globalCrypto.randomUUID()
  }
  return `rel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}
