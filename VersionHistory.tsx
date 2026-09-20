import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import type { Release } from './release'
import { formatReleaseDate } from './release'
import { StatusPill } from './StatusPill'
import { GlobeIcon } from './icons'

interface VersionHistoryProps {
  releases: Release[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
}

export function VersionHistory({
  releases,
  selectedId,
  onSelect,
  onCreate,
}: VersionHistoryProps) {
  const listRef = useRef<HTMLUListElement>(null)

  /** Up/Down walk the list; Home/End jump to its ends. */
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End']
    if (!keys.includes(event.key)) return
    event.preventDefault()

    const rows = listRef.current?.querySelectorAll<HTMLButtonElement>('.history__row')
    if (!rows || rows.length === 0) return

    const next =
      event.key === 'ArrowDown'
        ? Math.min(index + 1, rows.length - 1)
        : event.key === 'ArrowUp'
          ? Math.max(index - 1, 0)
          : event.key === 'Home'
            ? 0
            : rows.length - 1

    rows[next]?.focus()
  }

  return (
    <section aria-labelledby="history-heading">
      <div className="section-head">
        <h2 className="eyebrow" id="history-heading">
          Version history
        </h2>
        <button type="button" className="btn btn--primary btn--sm" onClick={onCreate}>
          + New Release
        </button>
      </div>

      {releases.length === 0 ? (
        <p className="history__empty">
          No releases yet. Create the first one to start the history.
        </p>
      ) : (
        <ul className="history__list" ref={listRef}>
          {releases.map((release, index) => (
            <li key={release.id}>
              <button
                type="button"
                className="history__row"
                aria-current={release.id === selectedId}
                onClick={() => onSelect(release.id)}
                onKeyDown={(event) => onKeyDown(event, index)}
              >
                <span className="history__left">
                  <span className="history__version">{release.version}</span>
                  <StatusPill status={release.status} />
                </span>
                <span className="history__right">
                  {release.publishedToWebsite ? (
                    <span
                      className="history__live"
                      data-live="true"
                      title="Live on the vClyps website"
                    >
                      <GlobeIcon />
                      <span className="sr-only">Published to website</span>
                    </span>
                  ) : null}
                  <span className="history__date">{formatReleaseDate(release.releaseDate)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
