import { useRef } from 'react'

interface BulletEditorProps {
  notes: string[]
  onChange: (notes: string[]) => void
  /** Called with the value to persist, so callers never read stale state. */
  onCommit?: (notes: string[]) => void
  idPrefix: string
  placeholder?: string
}

/**
 * Release notes as a list of bullets. Enter adds the next bullet and moves to
 * it; Backspace on an empty bullet removes it and steps back — the rhythm of a
 * plain list, without a rich-text editor.
 */
export function BulletEditor({
  notes,
  onChange,
  onCommit,
  idPrefix,
  placeholder = 'Describe one change',
}: BulletEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rows = notes.length > 0 ? notes : ['']

  function focusRow(index: number, caret: 'end' | 'start' = 'end') {
    requestAnimationFrame(() => {
      const inputs = containerRef.current?.querySelectorAll<HTMLInputElement>('input')
      const input = inputs?.[Math.max(0, Math.min(index, (inputs?.length ?? 1) - 1))]
      if (!input) return
      input.focus()
      const position = caret === 'end' ? input.value.length : 0
      input.setSelectionRange(position, position)
    })
  }

  function update(index: number, value: string) {
    const next = [...rows]
    next[index] = value
    onChange(next)
  }

  function insertAfter(index: number) {
    const next = [...rows]
    next.splice(index + 1, 0, '')
    onChange(next)
    focusRow(index + 1)
  }

  function removeAt(index: number): string[] {
    const next = rows.filter((_, i) => i !== index)
    onChange(next)
    focusRow(Math.max(0, index - 1))
    return next
  }

  return (
    <div className="bullets" ref={containerRef}>
      {rows.map((note, index) => (
        <div className="bullets__row" key={`${idPrefix}-${index}`}>
          <span className="bullets__marker" aria-hidden="true">
            •
          </span>
          <input
            className="input"
            value={note}
            placeholder={index === 0 ? placeholder : ''}
            aria-label={`Release note ${index + 1}`}
            onChange={(event) => update(index, event.target.value)}
            onBlur={() => onCommit?.(rows)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                insertAfter(index)
              } else if (event.key === 'Backspace' && note === '' && rows.length > 1) {
                event.preventDefault()
                removeAt(index)
              } else if (event.key === 'ArrowDown' && index < rows.length - 1) {
                event.preventDefault()
                focusRow(index + 1)
              } else if (event.key === 'ArrowUp' && index > 0) {
                event.preventDefault()
                focusRow(index - 1)
              }
            }}
          />
          <button
            type="button"
            className="bullets__remove"
            aria-label={`Remove release note ${index + 1}`}
            disabled={rows.length === 1 && note === ''}
            onClick={() => onCommit?.(removeAt(index))}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn--quiet btn--sm bullets__add"
        onClick={() => insertAfter(rows.length - 1)}
      >
        + Add note
      </button>
    </div>
  )
}
