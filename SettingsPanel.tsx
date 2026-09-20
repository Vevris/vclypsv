import { useEffect, useState } from 'react'
import type { Settings } from './settings'
import type { UpdateLogEntry, WebsitePublisher } from './publishing'
import { formatReleaseDate, formatTimestamp } from './release'
import { Modal } from './Modal'

interface SettingsPanelProps {
  settings: Settings
  publisher: WebsitePublisher
  onSave: (settings: Settings) => void
  onClose: () => void
  onRefresh: () => void
}

/**
 * Settings covers the two things this tool genuinely has to be configurable
 * about: where releases get published, and how destructive actions behave. It
 * also shows the live update log, so publishing can be verified without
 * leaving the app.
 */
export function SettingsPanel({
  settings,
  publisher,
  onSave,
  onClose,
  onRefresh,
}: SettingsPanelProps) {
  const [draft, setDraft] = useState(settings)
  const [log, setLog] = useState<UpdateLogEntry[] | null>(null)
  const [logError, setLogError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLog(null)
    setLogError(null)
    publisher
      .getUpdateLog()
      .then((entries) => {
        if (!cancelled) setLog(entries)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLogError(error instanceof Error ? error.message : 'Could not read the update log.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [publisher])

  return (
    <Modal
      title="Settings"
      subtitle="Publishing target and workspace preferences."
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              onSave(draft)
              onClose()
            }}
          >
            Save settings
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="settings-base-url">Website API base URL</label>
        <input
          id="settings-base-url"
          className="input mono"
          value={draft.websiteApiBaseUrl}
          placeholder="Leave blank to use the local mock"
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => setDraft({ ...draft, websiteApiBaseUrl: event.target.value })}
        />
        <span className="detail__note">
          Currently publishing to <strong>{publisher.targetLabel}</strong>. Leave this blank to keep
          using the Supabase update log, or point it at the real vClyps API when its endpoints go
          live — nothing else in the app changes.
        </span>
      </div>

      <div className="field">
        <label htmlFor="settings-token">API token</label>
        <input
          id="settings-token"
          className="input mono"
          type="password"
          value={draft.websiteApiToken}
          placeholder="Optional"
          autoComplete="off"
          onChange={(event) => setDraft({ ...draft, websiteApiToken: event.target.value })}
        />
      </div>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={draft.confirmBeforeDelete}
          onChange={(event) => setDraft({ ...draft, confirmBeforeDelete: event.target.checked })}
        />
        <span>Ask for confirmation before deleting a release.</span>
      </label>

      <div className="field">
        <label>Website update log</label>
        {logError ? (
          <span className="error-text">{logError}</span>
        ) : log === null ? (
          <div className="skeleton" style={{ height: 64 }} />
        ) : log.length === 0 ? (
          <div className="log">
            <p className="log__empty">Nothing published yet.</p>
          </div>
        ) : (
          <ul className="log">
            {log.map((entry) => (
              <li className="log__item" key={entry.id}>
                <div className="log__head">
                  <span className="mono" style={{ fontSize: 13 }}>
                    {entry.version}
                  </span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                    {formatReleaseDate(entry.releaseDate)} · published{' '}
                    {formatTimestamp(entry.publishedAt)}
                  </span>
                </div>
                <ul className="log__notes">
                  {entry.notes.map((note, index) => (
                    <li key={index}>{note}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        <span className="detail__note">
          Exactly what the website receives. Internal notes never appear here.
        </span>
      </div>

      <div className="field">
        <label>Data</label>
        <div>
          <button type="button" className="btn btn--sm" onClick={onRefresh}>
            Reload from Supabase
          </button>
        </div>
        <span className="detail__note">
          Releases are stored in Supabase, not in this browser, so everyone on the team sees the
          same history. Reload to pick up changes someone else made.
        </span>
      </div>
    </Modal>
  )
}
