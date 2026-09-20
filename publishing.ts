import type { PublicRelease } from './release'
import type { Settings } from './settings'
import { HttpWebsitePublisher } from './httpPublisher'
import { SupabaseWebsitePublisher } from './supabasePublisher'

/**
 * The contract between this tool and the vClyps website's update log.
 *
 * Everything the UI knows about publishing goes through this interface, so the
 * mock publisher can be swapped for the real website API without touching a
 * single component. Note the payload type: a publisher can only ever receive
 * `PublicRelease`, which has no internal notes field.
 */
export interface WebsitePublisher {
  /** Human-readable name of the target, shown in Settings. */
  readonly targetLabel: string

  /** Creates or updates the website's update-log entry for this release. */
  publish(release: PublicRelease): Promise<PublishReceipt>

  /** Removes the release from the website's update log. */
  unpublish(releaseId: string): Promise<void>

  /** Everything currently live on the website, newest first. */
  getUpdateLog(): Promise<UpdateLogEntry[]>
}

export interface PublishReceipt {
  /** ISO timestamp recorded against the release once the website accepts it. */
  publishedAt: string
}

export interface UpdateLogEntry extends PublicRelease {
  publishedAt: string
}

export class PublishError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PublishError'
  }
}

/**
 * Chooses the publishing backend. By default releases publish to the Supabase
 * update log, which is what the vClyps site reads today. Set a website API
 * base URL in Settings to point the same UI at a real HTTP API instead.
 */
export function createWebsitePublisher(settings: Settings): WebsitePublisher {
  const baseUrl = settings.websiteApiBaseUrl.trim()
  if (baseUrl === '') return new SupabaseWebsitePublisher()
  return new HttpWebsitePublisher({
    baseUrl,
    apiToken: settings.websiteApiToken.trim() || undefined,
  })
}

export { SupabaseWebsitePublisher } from './supabasePublisher'
export { HttpWebsitePublisher } from './httpPublisher'
export { MockWebsitePublisher } from './mockPublisher'
