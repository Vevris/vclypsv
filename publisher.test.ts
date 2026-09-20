import { beforeEach, describe, expect, it } from 'vitest'
import type { Release } from './release'
import { toPublicRelease } from './release'
import { MockWebsitePublisher } from './mockPublisher'
import { PublishError } from './publishing'

/** Minimal in-memory `localStorage` so the mock publisher can run under Node. */
class MemoryStorage {
  private map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null
  }
  getItem(key: string) {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.map.set(key, value)
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
  clear() {
    this.map.clear()
  }
}

function makeRelease(overrides: Partial<Release> = {}): Release {
  return {
    id: 'rel_1',
    version: 'v0.8.2',
    releaseDate: '2026-09-19',
    status: 'production',
    releaseNotes: ['Faster clip processing', 'Improved subtitle detection'],
    internalNotes: 'Encoder memory spikes on long 4K sessions — watch this.',
    publishedToWebsite: false,
    publishedAt: null,
    ...overrides,
  }
}

describe('MockWebsitePublisher', () => {
  let publisher: MockWebsitePublisher

  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: new MemoryStorage(),
      configurable: true,
      writable: true,
    })
    publisher = new MockWebsitePublisher(0)
  })

  it('publishes the public projection to the update log', async () => {
    const release = makeRelease()
    const receipt = await publisher.publish(toPublicRelease(release))

    expect(receipt.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    const log = await publisher.getUpdateLog()
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({
      id: 'rel_1',
      version: 'v0.8.2',
      releaseDate: '2026-09-19',
      notes: ['Faster clip processing', 'Improved subtitle detection'],
    })
  })

  it('never writes internal notes to the update log', async () => {
    await publisher.publish(toPublicRelease(makeRelease()))

    const log = await publisher.getUpdateLog()
    const serialized = JSON.stringify(log)

    expect(serialized).not.toContain('Encoder memory')
    expect(serialized).not.toContain('internalNotes')
  })

  it('updates an existing entry instead of duplicating it', async () => {
    await publisher.publish(toPublicRelease(makeRelease()))
    await publisher.publish(
      toPublicRelease(makeRelease({ version: 'v0.8.3', releaseNotes: ['One fix'] })),
    )

    const log = await publisher.getUpdateLog()
    expect(log).toHaveLength(1)
    expect(log[0]?.version).toBe('v0.8.3')
    expect(log[0]?.notes).toEqual(['One fix'])
  })

  it('removes an entry on unpublish', async () => {
    await publisher.publish(toPublicRelease(makeRelease()))
    await publisher.unpublish('rel_1')

    expect(await publisher.getUpdateLog()).toEqual([])
  })

  it('refuses to publish a release with no public notes', async () => {
    await expect(
      publisher.publish(toPublicRelease(makeRelease({ releaseNotes: [] }))),
    ).rejects.toBeInstanceOf(PublishError)

    expect(await publisher.getUpdateLog()).toEqual([])
  })

  it('returns the log newest first', async () => {
    await publisher.publish(toPublicRelease(makeRelease({ id: 'a', releaseDate: '2026-09-12' })))
    await publisher.publish(toPublicRelease(makeRelease({ id: 'b', releaseDate: '2026-09-19' })))

    expect((await publisher.getUpdateLog()).map((entry) => entry.id)).toEqual(['b', 'a'])
  })
})
