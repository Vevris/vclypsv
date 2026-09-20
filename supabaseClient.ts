import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase is the only store for releases.
 *
 * The connection details are built in rather than read from a `.env` file, so
 * the app runs straight after `npm install` with nothing to configure. They
 * are safe to commit: the publishable key identifies the project and carries
 * no privileges of its own — what it may do is decided by the row-level
 * security policies in the database, not by hiding the key. It ends up in the
 * built JavaScript bundle either way.
 *
 * Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to point the app
 * at a different project; either one overrides the default below.
 */

const DEFAULT_URL = 'https://eaxovmgcdxyaflzzooxm.supabase.co'
const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_l8c1CXOgwqQ1cdIv-lHvCg_Rmi3Oec0'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_URL
const key =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || DEFAULT_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(url && key)

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart the dev server.',
    )
    this.name = 'SupabaseNotConfiguredError'
  }
}

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!url || !key) throw new SupabaseNotConfiguredError()
  client ??= createClient(url, key, { auth: { persistSession: false } })
  return client
}
