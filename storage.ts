/**
 * Small, defensive wrapper around `localStorage`. Reads never throw: a private
 * window, blocked site data or a corrupted value all fall back to the default.
 */

function getStore(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function readJson<T>(key: string, fallback: T): T {
  const store = getStore()
  if (!store) return fallback
  try {
    const raw = store.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  const store = getStore()
  if (!store) return
  try {
    store.setItem(key, JSON.stringify(value))
  } catch {
    /* Quota or blocked storage — the in-memory state stays authoritative. */
  }
}

export function removeKey(key: string): void {
  const store = getStore()
  if (!store) return
  try {
    store.removeItem(key)
  } catch {
    /* no-op */
  }
}
