import { readJson, writeJson } from './storage'

export interface Settings {
  /** Blank means "use the local mock publisher". */
  websiteApiBaseUrl: string
  websiteApiToken: string
  /** Ask before deleting a release. On by default, and hard to argue with. */
  confirmBeforeDelete: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  websiteApiBaseUrl: '',
  websiteApiToken: '',
  confirmBeforeDelete: true,
}

const SETTINGS_KEY = 'vclyps.releaseManager.settings'

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...readJson<Partial<Settings>>(SETTINGS_KEY, {}) }
}

export function saveSettings(settings: Settings): void {
  writeJson(SETTINGS_KEY, settings)
}
