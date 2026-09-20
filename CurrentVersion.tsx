import type { Release } from './release'
import { STATUS_LABELS, formatReleaseDate } from './release'
import { EditableVersion } from './EditableVersion'
import { GlobeIcon } from './icons'

interface CurrentVersionProps {
  release: Release | null
  otherVersions: string[]
  onVersionChange: (version: string) => void
}

export function CurrentVersion({ release, otherVersions, onVersionChange }: CurrentVersionProps) {
  if (!release) {
    return (
      <section className="current" aria-labelledby="current-version-heading">
        <h1 className="eyebrow" id="current-version-heading">
          Current version
        </h1>
        <p className="current__empty">
          No release is marked as production. Open a release and set its status to Production, or
          create a new one.
        </p>
      </section>
    )
  }

  return (
    <section className="current" aria-labelledby="current-version-heading">
      <h1 className="eyebrow" id="current-version-heading">
        Current version
      </h1>

      <EditableVersion
        value={release.version}
        otherVersions={otherVersions}
        onCommit={onVersionChange}
        label="production version number"
      />

      <div className="current__meta">
        <span className="pill pill--production">{STATUS_LABELS[release.status]}</span>
        <span className="current__dot" aria-hidden="true" />
        <span className="current__date">Released {formatReleaseDate(release.releaseDate)}</span>
        {release.publishedToWebsite ? (
          <>
            <span className="current__dot" aria-hidden="true" />
            <span className="current__date" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <GlobeIcon />
              Live on website
            </span>
          </>
        ) : null}
      </div>
    </section>
  )
}
