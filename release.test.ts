import { describe, expect, it } from 'vitest'
import type { Release } from './release'
import {
  applyStatusChange,
  bumpVersion,
  cleanReleaseNotes,
  findCurrentRelease,
  formatReleaseDate,
  normalizeVersion,
  sortReleases,
  toPublicRelease,
  validateReleaseDate,
  validateVersion,
} from './release'

function makeRelease(overrides: Partial<Release> = {}): Release {
  return {
    id: 'rel_test',
    version: 'v1.0.0',
    releaseDate: '2026-09-19',
    status: 'previous',
    releaseNotes: ['A change'],
    internalNotes: 'Internal only',
    publishedToWebsite: false,
    publishedAt: null,
    ...overrides,
  }
}

describe('validateVersion', () => {
  it('accepts any shape the team wants, without semver rules', () => {
    for (const version of ['v0.8.3', 'v0.9', 'v1.0', 'v2.4.7', '1.2.3.4', 'v1.0.0-rc.1', '3']) {
      expect(validateVersion(version), version).toBeNull()
    }
  })

  it('never forces a major/minor/patch relationship between versions', () => {
    // v0.8.2 -> v2.4.7 skips everything in between, and that is allowed.
    expect(validateVersion('v2.4.7', { existingVersions: ['v0.8.2'] })).toBeNull()
    // Going backwards is allowed too — the version is just data.
    expect(validateVersion('v0.7.0', { existingVersions: ['v0.8.2'] })).toBeNull()
  })

  it('rejects obviously broken input', () => {
    expect(validateVersion('')).toMatch(/empty/i)
    expect(validateVersion('   ')).toMatch(/empty/i)
    expect(validateVersion('version')).toMatch(/number/i)
    expect(validateVersion('v1.0 (beta)')).not.toBeNull()
    expect(validateVersion('v' + '9'.repeat(40))).toMatch(/longer/i)
  })

  it('rejects duplicates case-insensitively', () => {
    expect(validateVersion('V1.0', { existingVersions: ['v1.0'] })).toMatch(/already exists/i)
  })

  it('trims and strips whitespace before validating', () => {
    expect(normalizeVersion('  v1.2.3  ')).toBe('v1.2.3')
    expect(normalizeVersion('v 1.2.3')).toBe('v1.2.3')
  })
})

describe('validateReleaseDate', () => {
  it('accepts ISO calendar dates', () => {
    expect(validateReleaseDate('2026-09-19')).toBeNull()
  })

  it('rejects anything else', () => {
    expect(validateReleaseDate('')).not.toBeNull()
    expect(validateReleaseDate('19/09/2026')).not.toBeNull()
    expect(validateReleaseDate('2026-13-45')).not.toBeNull()
  })
})

describe('formatReleaseDate', () => {
  it('formats without shifting the day across time zones', () => {
    expect(formatReleaseDate('2026-09-19')).toBe('Sep 19, 2026')
    expect(formatReleaseDate('2026-01-01')).toBe('Jan 01, 2026')
  })
})

describe('toPublicRelease', () => {
  it('never carries internal notes across the website boundary', () => {
    const publicRelease = toPublicRelease(
      makeRelease({ internalNotes: 'Do not ship: rollback plan in runbook' }),
    )

    expect(JSON.stringify(publicRelease)).not.toContain('rollback plan')
    expect(Object.keys(publicRelease).sort()).toEqual(['id', 'notes', 'releaseDate', 'version'])
    expect('internalNotes' in publicRelease).toBe(false)
  })

  it('drops blank bullets', () => {
    const publicRelease = toPublicRelease(
      makeRelease({ releaseNotes: ['Kept', '   ', '', 'Also kept'] }),
    )
    expect(publicRelease.notes).toEqual(['Kept', 'Also kept'])
  })
})

describe('cleanReleaseNotes', () => {
  it('trims and removes empties', () => {
    expect(cleanReleaseNotes([' one ', '', '  ', 'two'])).toEqual(['one', 'two'])
  })
})

describe('sortReleases and findCurrentRelease', () => {
  const releases = [
    makeRelease({ id: 'a', version: 'v0.8.0', releaseDate: '2026-09-12' }),
    makeRelease({ id: 'b', version: 'v0.8.2', releaseDate: '2026-09-19', status: 'production' }),
    makeRelease({ id: 'c', version: 'v0.8.1', releaseDate: '2026-09-17' }),
  ]

  it('orders newest first', () => {
    expect(sortReleases(releases).map((release) => release.id)).toEqual(['b', 'c', 'a'])
  })

  it('reports the production release as current', () => {
    expect(findCurrentRelease(releases)?.version).toBe('v0.8.2')
  })

  it('returns null when nothing is in production', () => {
    expect(findCurrentRelease([makeRelease({ status: 'draft' })])).toBeNull()
  })
})

describe('applyStatusChange', () => {
  it('keeps exactly one release in production', () => {
    const before = [
      makeRelease({ id: 'a', status: 'production' }),
      makeRelease({ id: 'b', status: 'previous' }),
    ]
    const after = applyStatusChange(before, 'b', 'production')

    expect(after.find((release) => release.id === 'a')?.status).toBe('previous')
    expect(after.find((release) => release.id === 'b')?.status).toBe('production')
    expect(after.filter((release) => release.status === 'production')).toHaveLength(1)
  })

  it('leaves other releases alone for non-production changes', () => {
    const before = [
      makeRelease({ id: 'a', status: 'production' }),
      makeRelease({ id: 'b', status: 'previous' }),
    ]
    const after = applyStatusChange(before, 'b', 'draft')

    expect(after.find((release) => release.id === 'a')?.status).toBe('production')
    expect(after.find((release) => release.id === 'b')?.status).toBe('draft')
  })
})

describe('bumpVersion', () => {
  it('suggests major, minor and patch bumps', () => {
    expect(bumpVersion('v0.8.2', 'major')).toBe('v1.0.0')
    expect(bumpVersion('v0.8.2', 'minor')).toBe('v0.9.0')
    expect(bumpVersion('v0.8.2', 'patch')).toBe('v0.8.3')
  })

  it('pads short versions to three parts', () => {
    expect(bumpVersion('v0.9', 'patch')).toBe('v0.9.1')
    expect(bumpVersion('v0.9', 'minor')).toBe('v0.10.0')
    expect(bumpVersion('v2', 'major')).toBe('v3.0.0')
  })

  it('drops a pre-release suffix', () => {
    expect(bumpVersion('v1.0.0-rc.1', 'patch')).toBe('v1.0.1')
  })

  it('keeps the prefix exactly as written', () => {
    expect(bumpVersion('1.2.3', 'patch')).toBe('1.2.4')
    expect(bumpVersion('V1.2.3', 'minor')).toBe('V1.3.0')
  })

  it('returns null when there is nothing numeric to bump', () => {
    expect(bumpVersion('nightly', 'patch')).toBeNull()
    expect(bumpVersion('', 'major')).toBeNull()
  })

  it('still allows any manual version afterwards', () => {
    // A suggestion is only a starting point; validation stays permissive.
    expect(validateVersion('v4.0.0-beta', { existingVersions: ['v0.8.2'] })).toBeNull()
  })
})
