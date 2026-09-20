import { useEffect, useState } from 'react'

export interface Notice {
  id: number
  message: string
  tone: 'ok' | 'error'
}

/**
 * Quiet confirmation that something landed. Errors stay up longer than
 * successes, because they need reading.
 */
export function Toast({ notice }: { notice: Notice | null }) {
  const [visible, setVisible] = useState<Notice | null>(notice)

  useEffect(() => {
    setVisible(notice)
    if (!notice) return
    const timeout = setTimeout(() => setVisible(null), notice.tone === 'error' ? 5200 : 2200)
    return () => clearTimeout(timeout)
  }, [notice])

  if (!visible) return null

  return (
    <div className="toast" data-tone={visible.tone} role="status" aria-live="polite">
      <span className="toast__dot" />
      {visible.message}
    </div>
  )
}
