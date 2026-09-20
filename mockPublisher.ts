import type { PublicRelease } from './release'
import type { PublishReceipt, UpdateLogEntry, WebsitePublisher } from './publishing'
import { PublishError } from './publishing'
import { readJson, writeJson } from './storage'

export const MOCK_UPDATE_LOG_KEY = 'vclyps.website.updateLog'

/**
 * Stands in for the vClyps website's update log while the real API does not
 * exist yet. It persists to the same place the site's backend eventually will,
 * so publishing is genuinely observable during development: publish a release,
 * then open Settings to see the entry the website would be serving.
 */
export class MockWebsitePublisher implements WebsitePublisher {
  readonly targetLabel = 'Local mock website'

  constructor(private readonly latencyMs = 320) {}

  async publish(release: PublicRelease): Promise<PublishReceipt> {
    await this.delay()

    if (release.notes.length === 0) {
      throw new PublishError('Add at least one release note before publishing.')
    }

    const publishedAt = new Date().toISOString()
    const log = this.read().filter((entry) => entry.id !== release.id)
    log.push({ ...release, publishedAt })
    this.write(log)

    return { publishedAt }
  }

  async unpublish(releaseId: string): Promise<void> {
    await this.delay()
    this.write(this.read().filter((entry) => entry.id !== releaseId))
  }

  async getUpdateLog(): Promise<UpdateLogEntry[]> {
    await this.delay()
    return [...this.read()].sort((a, b) => (a.releaseDate < b.releaseDate ? 1 : -1))
  }

  private read(): UpdateLogEntry[] {
    return readJson<UpdateLogEntry[]>(MOCK_UPDATE_LOG_KEY, [])
  }

  private write(entries: UpdateLogEntry[]): void {
    writeJson(MOCK_UPDATE_LOG_KEY, entries)
  }

  private delay(): Promise<void> {
    if (this.latencyMs <= 0) return Promise.resolve()
    return new Promise((resolve) => setTimeout(resolve, this.latencyMs))
  }
}
