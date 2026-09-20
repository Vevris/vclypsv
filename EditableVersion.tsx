import { useEffect, useRef, useState } from 'react'
import { VERSION_MAX_LENGTH, normalizeVersion, validateVersion } from './release'
import { VersionBumpButtons } from './VersionBumpButtons'

interface EditableVersionProps {
  value: string
  /** Every other version in the system, used only to catch duplicates. */
  otherVersions: string[]
  onCommit: (version: string) => void | Promise<void>
  /** `inline` is the smaller variant used inside the release detail pane. */
  variant?: 'display' | 'inline'
  label?: string
}

/**
 * Click the version to edit it in place. Enter saves, Escape cancels.
 *
 * The version string is treated as user-controlled data: no semver rules are
 * imposed, and nothing is ever auto-incremented. Validation exists only to
 * stop obviously broken input.
 */
export function EditableVersion({
  value,
  otherVersions,
  onCommit,
  variant = 'display',
  label = 'version number',
}: EditableVersionProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  /** Set by Escape so the blur that follows does not re-run the commit. */
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  function startEditing() {
    cancelledRef.current = false
    setDraft(value)
    setError(null)
    setEditing(true)
  }

  function cancel() {
    setDraft(value)
    setError(null)
    setEditing(false)
  }

  /**
   * `fromBlur` decides what happens to invalid input. Pressing Enter keeps the
   * editor open with the error visible so it can be fixed; clicking away
   * reverts instead, so a typo can never trap focus in the field.
   */
  function commit(fromBlur = false) {
    if (cancelledRef.current) {
      cancelledRef.current = false
      return
    }

    const next = normalizeVersion(draft)
    if (next === value) {
      cancel()
      return
    }

    const problem = validateVersion(next, { existingVersions: otherVersions })
    if (problem) {
      if (fromBlur) {
        cancel()
      } else {
        setError(problem)
      }
      return
    }

    setEditing(false)
    setError(null)
    void onCommit(next)
  }

  const className = variant === 'inline' ? 'version-edit version-edit--inline' : 'version-edit'

  if (!editing) {
    return (
      <div className={className}>
        <button
          type="button"
          className="version-edit__button"
          onClick={startEditing}
          aria-label={`Edit ${label}, currently ${value}`}
        >
          <span className="version-edit__value">{value}</span>
          <span className="version-edit__hint" aria-hidden="true">
            Click to edit
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        className="version-edit__input"
        value={draft}
        maxLength={VERSION_MAX_LENGTH}
        spellCheck={false}
        autoComplete="off"
        aria-label={`Edit ${label}`}
        aria-invalid={error !== null}
        aria-describedby={error ? 'version-edit-error' : undefined}
        onChange={(event) => {
          setDraft(event.target.value)
          if (error) setError(null)
        }}
        onBlur={() => commit(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            cancelledRef.current = true
            cancel()
          }
        }}
      />
      <VersionBumpButtons
        baseVersion={value}
        currentValue={normalizeVersion(draft)}
        onPick={(next) => {
          setDraft(next)
          setError(null)
        }}
      />
      <div className="version-edit__footer">
        {error ? (
          <span className="error-text" id="version-edit-error" role="alert">
            {error}
          </span>
        ) : (
          <span>
            <span className="kbd">Enter</span> to save · <span className="kbd">Esc</span> to cancel
          </span>
        )}
      </div>
    </div>
  )
}
