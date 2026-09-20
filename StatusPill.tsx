import type { ReleaseStatus } from './release'
import { STATUS_LABELS } from './release'

export function StatusPill({ status }: { status: ReleaseStatus }) {
  return <span className={`pill pill--${status}`}>{STATUS_LABELS[status]}</span>
}
