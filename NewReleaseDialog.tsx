import { useState } from 'react'
import type { ReleaseInput, ReleaseStatus } from './release'
import {
  STATUS_LABELS,
  STATUS_ORDER,
  bumpVersion,
  cleanReleaseNotes,
  todayIsoDate,
  validateReleaseDate,
  validateVersion,
} from './release'
import { BulletEditor } from './BulletEditor'
import { Modal } from './Modal'
import { VersionBumpButtons } from './VersionBumpButtons'

interface NewReleaseDialogProps {
  existingVersions: string[]
  /** The version bumps are calculated from — normally the production release. */
  baseVersion: string | null
  onCancel: () => void
  onCreate: (input: ReleaseInput, publish: boolean) => Promise<void>
}

/**
 * The version field opens on a patch bump of the current release, with major
 * and minor a click away — the common case should not need typing. The field
 * itself stays free text, so any version can be written over the suggestion.
 */
export function NewReleaseDialog({
  existingVersions,
  baseVersion,
  onCancel,
  onCreate,
}: NewReleaseDialogProps) {
  const [version, setVersion] = useState(
    () => (baseVersion ? bumpVersion(baseVersion, 'patch') : null) ?? '',
  )
  const [releaseDate, setReleaseDate] = useState(todayIsoDate())
  const [status, setStatus] = useState<ReleaseStatus>('draft')
  const [releaseNotes, setReleaseNotes] = useState<string[]>([''])
  const [internalNotes, setInternalNotes] = useState('')
  const [publish, setPublish] = useState(false)
  const [errors, setErrors] = useState<{ version?: string; releaseDate?: string; notes?: string }>({})
  const [saving, setSaving] = useState(false)

  async function submit() {
    const versionError = validateVersion(version, { existingVersions })
    const dateError = validateReleaseDate(releaseDate)
    const notes = cleanReleaseNotes(releaseNotes)
    const notesError =
      publish && notes.length === 0 ? 'Add at least one release note to publish this release.' : undefined

    if (versionError || dateError || notesError) {
      setErrors({
        version: versionError ?? undefined,
        releaseDate: dateError ?? undefined,
        notes: notesError,
      })
      return
    }

    setSaving(true)
    try {
      await onCreate({ version, releaseDate, status, releaseNotes: notes, internalNotes }, publish)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="New release"
      subtitle="The version is suggested from the current release. Change it to anything you like."
      wide
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={() => void submit()} disabled={saving}>
            {saving ? <span className="spinner" /> : null}
            Create release
          </button>
        </>
      }
    >
      <div className="field">
        <div>
          <label htmlFor="new-version" className="field__label">
            Version number
          </label>
          <input
            id="new-version"
            className="input mono"
            value={version}
            placeholder="v0.8.3"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={Boolean(errors.version)}
            onChange={(event) => {
              setVersion(event.target.value)
              if (errors.version) setErrors({ ...errors, version: undefined })
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void submit()
              }
            }}
          />
          {errors.version ? (
            <span className="error-text" role="alert">
              {errors.version}
            </span>
          ) : null}
        </div>
        {baseVersion ? (
          <VersionBumpButtons
            baseVersion={baseVersion}
            currentValue={version}
            onPick={(next) => {
              setVersion(next)
              if (errors.version) setErrors({ ...errors, version: undefined })
            }}
          />
        ) : null}
      </div>

      <div className="detail__grid">
        <div className="field">
          <label htmlFor="new-date">Release date</label>
          <input
            id="new-date"
            className="input mono"
            type="date"
            value={releaseDate}
            aria-invalid={Boolean(errors.releaseDate)}
            onChange={(event) => setReleaseDate(event.target.value)}
          />
          {errors.releaseDate ? (
            <span className="error-text" role="alert">
              {errors.releaseDate}
            </span>
          ) : null}
        </div>
      </div>

      <div className="field">
        <label htmlFor="new-status">Status</label>
        <select
          id="new-status"
          className="select"
          value={status}
          onChange={(event) => setStatus(event.target.value as ReleaseStatus)}
        >
          {STATUS_ORDER.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        {status === 'production' ? (
          <span className="detail__note">
            This becomes the current version. The release in production now moves to Previous.
          </span>
        ) : null}
      </div>

      <div className="field">
        <label>Release notes — public</label>
        <BulletEditor idPrefix="new" notes={releaseNotes} onChange={setReleaseNotes} />
        {errors.notes ? (
          <span className="error-text" role="alert">
            {errors.notes}
          </span>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="new-internal">Internal notes — never published</label>
        <textarea
          id="new-internal"
          className="textarea"
          value={internalNotes}
          placeholder="Context for the team. Stays in this tool."
          onChange={(event) => setInternalNotes(event.target.value)}
        />
      </div>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={publish}
          onChange={(event) => {
            setPublish(event.target.checked)
            if (errors.notes) setErrors({ ...errors, notes: undefined })
          }}
        />
        <span>
          Publish to the vClyps website straight away. Only the version, date and public notes are
          sent.
        </span>
      </label>
    </Modal>
  )
}
