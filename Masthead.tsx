import { SettingsIcon, VClypsMark } from './icons'

interface MastheadProps {
  onOpenSettings: () => void
  settingsOpen: boolean
}

export function Masthead({ onOpenSettings, settingsOpen }: MastheadProps) {
  return (
    <header className="masthead">
      <span className="masthead__mark">
        <VClypsMark />
        vClyps
      </span>
      <span className="masthead__divider" aria-hidden="true" />
      <span className="masthead__title">Release Manager</span>
      <span className="masthead__spacer" />
      <button
        type="button"
        className="icon-btn"
        onClick={onOpenSettings}
        aria-expanded={settingsOpen}
        aria-haspopup="dialog"
        aria-label="Settings"
        title="Settings"
      >
        <SettingsIcon />
      </button>
    </header>
  )
}
