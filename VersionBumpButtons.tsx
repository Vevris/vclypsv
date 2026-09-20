import type { BumpKind } from './release'
import { BUMP_LABELS, BUMP_ORDER, bumpVersion } from './release'

interface VersionBumpButtonsProps {
  /** The version the suggestions are calculated from. */
  baseVersion: string
  /** The value currently in the field, used to show which bump is selected. */
  currentValue?: string
  onPick: (version: string) => void
  label?: string
}

/**
 * Major / minor / patch shortcuts.
 *
 * These only fill in the version field — they never commit on their own and
 * never constrain what can be saved, so any version can still be typed by
 * hand. If the base version has nothing numeric to bump, nothing is offered.
 */
export function VersionBumpButtons({
  baseVersion,
  currentValue,
  onPick,
  label,
}: VersionBumpButtonsProps) {
  const suggestions = BUMP_ORDER.map((kind) => ({ kind, next: bumpVersion(baseVersion, kind) })).filter(
    (suggestion): suggestion is { kind: BumpKind; next: string } => suggestion.next !== null,
  )

  if (suggestions.length === 0) return null

  return (
    <div className="bumps">
      <span className="bumps__label">{label ?? `From ${baseVersion}`}</span>
      {suggestions.map(({ kind, next }) => (
        <button
          key={kind}
          type="button"
          className="bumps__btn"
          aria-pressed={currentValue === next}
          // Keep focus in the version field so its blur handler does not fire.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(next)}
          title={`${BUMP_LABELS[kind]} — ${next}`}
        >
          {BUMP_LABELS[kind]}
          <span className="bumps__next">{next}</span>
        </button>
      ))}
    </div>
  )
}
