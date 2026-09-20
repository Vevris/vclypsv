import { useEffect, useState } from 'react'
import type { Release, ReleaseStatus } from './release'
import {
  STATUS_LABELS,
  STATUS_ORDER,
  formatReleaseDate,
  formatTimestamp,
  validateReleaseDate,
} from './release'
import { BulletEditor } from './BulletEditor'
import { EditableVersion } from './EditableVersion'
import { CloseIcon, GlobeIcon } from './icons'

interface ReleaseDetailProps {
  release: Release | null
  otherVersions: string[]
  busy: boolean
  publisherLabel: string
  onClose: () => void
  onChange: (patch: Partial<Pick<Release, 'version' | 'releaseDate' | 'releaseNotes' | 'internalNotes'>>) => void
  onStatusChange: (status: ReleaseStatus) => void
  onPublish: () => void
  onUnpublish: () => void
  onDelete: () => void
}

/**
 * Edits are held locally while a field has focus and committed on blur, so
 * typing never round-trips through storage mid-keystroke.
 */
export function ReleaseDetail({
  release,
  otherVersions,
  busy,
  publisherLabel,
  onClose,
  onChange,
  onStatusChange,
  onPublish,
  onUnpublish,
  onDelete,
}: ReleaseDetailProps) {
  const [notes, setNotes] = useState<string[]>([])
  const [internal, setInternal] = useState('')
  const [date, setDate] = useState('')
  const [dateError, setDateError] = useState<string | null>(null)

  useEffect(() => {
    setNotes(release?.releaseNotes ?? [])
    setInternal(release?.internalNotes ?? '')
    setDate(release?.releaseDate ?? '')
    setDateError(null)
  }, [release])

  if (!release) {
    return (
      <section className="detail detail--closed" aria-labelledby="detail-heading">
        <div className="section-head">
          <h2 className="eyebrow" id="detail-heading">
            Release details
          </h2>
        </div>
        <p className="detail__placeholder">
          Select a release from the history to read or edit its notes.
        </p>
      </section>
    )
  }

  function commitNotes(next: string[]) {
    onChange({ releaseNotes: next })
  }

  function commitDate(value: string) {
    const problem = validateReleaseDate(value)
    setDateError(problem)
    if (!problem) onChange({ releaseDate: value })
  }

  return (
    <section className="detail detail--open" aria-labelledby="detail-heading">
      <div className="section-head">
        <h2 className="eyebrow" id="detail-heading">
          Release details
        </h2>
        <button
          type="button"
          className="icon-btn detail__close"
          onClick={onClose}
          aria-label="Close release details"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="detail__body">
        <div className="field">
          <label htmlFor={`version-${release.id}`}>Version number</label>
          <div id={`version-${release.id}`}>
            <EditableVersion
              key={release.id}
              value={release.version}
              otherVersions={otherVersions}
              onCommit={(version) => onChange({ version })}
              variant="inline"
            />
          </div>
        </div>

        <div className="detail__grid">
          <div className="field">
            <label htmlFor={`date-${release.id}`}>Release date</label>
            <input
              id={`date-${release.id}`}
              className="input mono"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              onBlur={(event) => commitDate(event.target.value)}
              aria-invalid={dateError !== null}
            />
            {dateError ? (
              <span className="error-text" role="alert">
                {dateError}
              </span>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor={`status-${release.id}`}>Status</label>
            <select
              id={`status-${release.id}`}
              className="select"
              value={release.status}
              onChange={(event) => onStatusChange(event.target.value as ReleaseStatus)}
            >
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            {release.status === 'production' ? (
              <span className="detail__note">Only one release can be in production at a time.</span>
            ) : null}
          </div>
        </div>

        <div className="field">
          <label htmlFor={`notes-${release.id}`}>Release notes — public</label>
          <div id={`notes-${release.id}`}>
            <BulletEditor
              key={release.id}
              idPrefix={release.id}
              notes={notes}
              onChange={setNotes}
              onCommit={commitNotes}
            />
          </div>
          <span className="detail__note">
            These bullets are what the website shows under “What’s new”.
          </span>
        </div>

        <div className="field">
          <label htmlFor={`internal-${release.id}`}>Internal notes — never published</label>
          <textarea
            id={`internal-${release.id}`}
            className="textarea"
            value={internal}
            placeholder="Context for the team: rollout plan, known issues, owners."
            onChange={(event) => setInternal(event.target.value)}
            onBlur={() => onChange({ internalNotes: internal })}
          />
          <span className="detail__note">
            Internal notes stay in this tool. They are never sent to the website.
          </span>
        </div>

        <div className="detail__publish-state" data-live={release.publishedToWebsite}>
          <span className="detail__publish-copy">
            <span className="detail__publish-title">
              {release.publishedToWebsite ? 'Live on the vClyps website' : 'Not published'}
            </span>
            <span className="detail__publish-sub">
              {release.publishedToWebsite
                ? `Published ${formatTimestamp(release.publishedAt)}`
                : `Target: ${publisherLabel}`}
            </span>
          </span>
          {release.publishedToWebsite ? (
            <span style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn--sm" disabled={busy} onClick={onPublish}>
                {busy ? <span className="spinner" /> : null}
                Update website
              </button>
              <button
                type="button"
                className="btn btn--sm btn--quiet"
                disabled={busy}
                onClick={onUnpublish}
              >
                Remove
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={busy}
              onClick={onPublish}
            >
              {busy ? <span className="spinner" /> : <GlobeIcon />}
              Publish to website
            </button>
          )}
        </div>

        <div className="detail__actions">
          <span className="detail__note">
            Created for {formatReleaseDate(release.releaseDate)}
          </span>
          <span className="detail__actions-spacer" />
          <button type="button" className="btn btn--danger btn--sm" onClick={onDelete}>
            Delete release
          </button>
        </div>
      </div>
    </section>
  )
}
