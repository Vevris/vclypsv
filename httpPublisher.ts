import type { PublicRelease } from './release'
import type { PublishReceipt, UpdateLogEntry, WebsitePublisher } from './publishing'
import { PublishError } from './publishing'

export interface HttpPublisherConfig {
  /** e.g. `https://vclyps.com/api` */
  baseUrl: string
  /** Optional bearer token for the website's update-log endpoints. */
  apiToken?: string
}

/**
 * The real website integration, ready for the day the vClyps site exposes its
 * update-log endpoints. It expects:
 *
 *   PUT    {baseUrl}/update-log/{id}   -> upsert, body: PublicRelease
 *   DELETE {baseUrl}/update-log/{id}   -> remove
 *   GET    {baseUrl}/update-log        -> UpdateLogEntry[]
 *
 * Point Settings at a base URL to switch the app over; nothing else changes.
 * If the real endpoints end up shaped differently, this file is the only one
 * that has to move.
 */
export class HttpWebsitePublisher implements WebsitePublisher {
  readonly targetLabel: string

  constructor(private readonly config: HttpPublisherConfig) {
    this.targetLabel = config.baseUrl
  }

  async publish(release: PublicRelease): Promise<PublishReceipt> {
    const response = await this.request(`/update-log/${encodeURIComponent(release.id)}`, {
      method: 'PUT',
      body: JSON.stringify(release),
    })
    const body = (await response.json().catch(() => ({}))) as Partial<PublishReceipt>
    return { publishedAt: body.publishedAt ?? new Date().toISOString() }
  }

  async unpublish(releaseId: string): Promise<void> {
    await this.request(`/update-log/${encodeURIComponent(releaseId)}`, { method: 'DELETE' })
  }

  async getUpdateLog(): Promise<UpdateLogEntry[]> {
    const response = await this.request('/update-log', { method: 'GET' })
    return (await response.json()) as UpdateLogEntry[]
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.config.apiToken) headers.Authorization = `Bearer ${this.config.apiToken}`

    let response: Response
    try {
      response = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}${path}`, {
        ...init,
        headers,
      })
    } catch {
      throw new PublishError(`Could not reach ${this.config.baseUrl}.`)
    }

    if (!response.ok) {
      throw new PublishError(`Website responded with ${response.status}.`)
    }
    return response
  }
}
