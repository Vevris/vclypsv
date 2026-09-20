import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Release, ReleaseInput } from './release'
import { CurrentVersion } from './CurrentVersion'
import { Masthead } from './Masthead'
import { NewReleaseDialog } from './NewReleaseDialog'
import { ReleaseDetail } from './ReleaseDetail'
import { SettingsPanel } from './SettingsPanel'
import { VersionHistory } from './VersionHistory'
import { ConfirmDialog } from './ConfirmDialog'
import { Toast } from './Toast'
import type { Notice } from './Toast'
import { useReleases } from './useReleases'
import { SupabaseReleaseRepository } from './releaseRepository'
import { isSupabaseConfigured } from './supabaseClient'
import { createWebsitePublisher } from './publishing'
import { loadSettings, saveSettings } from './settings'
import type { Settings } from './settings'

/**
 * Releases live in Supabase. Swap this for another `ReleaseRepository` and the
 * rest of the app is unaffected — every component reads through `useReleases`.
 */
const repository = new SupabaseReleaseRepository()

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [notice, setNotice] = useState<Notice | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Release | null>(null)

  const publisher = useMemo(() => createWebsitePublisher(settings), [settings])

  const notify = useCallback((message: string, tone: 'ok' | 'error' = 'ok') => {
    setNotice({ id: Date.now(), message, tone })
  }, [])

  const releases = useReleases(repository, publisher, notify)
  const { releases: allReleases, currentRelease, loadState, loadError, busyId } = releases

  const selected = allReleases.find((release) => release.id === selectedId) ?? null

  // A deleted release should not leave a detail pane behind.
  useEffect(() => {
    if (selectedId && !allReleases.some((release) => release.id === selectedId)) {
      setSelectedId(null)
    }
  }, [allReleases, selectedId])

  // Escape closes the detail pane when no dialog is on top of it.
  useEffect(() => {
    if (!selectedId || creating || settingsOpen || pendingDelete) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedId(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selectedId, creating, settingsOpen, pendingDelete])

  function versionsExcept(id: string | null): string[] {
    return allReleases.filter((release) => release.id !== id).map((release) => release.version)
  }

  async function handleCreate(input: ReleaseInput, publishNow: boolean) {
    const created = await releases.createRelease(input)
    if (!created) return // The dialog stays open so the input is not lost.
    setCreating(false)
    setSelectedId(created.id)
    if (publishNow) await releases.publish(created.id)
  }

  function requestDelete(release: Release) {
    if (settings.confirmBeforeDelete) {
      setPendingDelete(release)
    } else {
      void releases.deleteRelease(release.id)
    }
  }

  return (
    <div className="shell">
      <Masthead settingsOpen={settingsOpen} onOpenSettings={() => setSettingsOpen(true)} />

      <main className="main">
        {!isSupabaseConfigured ? (
          <div className="state" role="alert">
            <p className="state__title">Supabase is not configured.</p>
            <p className="detail__note" style={{ maxWidth: '52ch' }}>
              Copy <code>.env.example</code> to <code>.env</code>, set{' '}
              <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>, then
              restart the dev server. Release data is stored in Supabase, never in this browser.
            </p>
          </div>
        ) : loadState === 'loading' ? (
          <LoadingState />
        ) : loadState === 'error' ? (
          <div className="state" role="alert">
            <p className="state__title">{loadError ?? 'Something went wrong.'}</p>
            <button type="button" className="btn" onClick={releases.reload}>
              Try again
            </button>
          </div>
        ) : (
          <>
            <CurrentVersion
              release={currentRelease}
              otherVersions={versionsExcept(currentRelease?.id ?? null)}
              onVersionChange={(version) => {
                if (currentRelease) void releases.updateRelease(currentRelease.id, { version })
              }}
            />

            <div className="workspace">
              <VersionHistory
                releases={allReleases}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onCreate={() => setCreating(true)}
              />

              <ReleaseDetail
                release={selected}
                otherVersions={versionsExcept(selectedId)}
                busy={busyId === selectedId}
                publisherLabel={publisher.targetLabel}
                onClose={() => setSelectedId(null)}
                onChange={(patch) => {
                  if (selected) void releases.updateRelease(selected.id, patch)
                }}
                onStatusChange={(status) => {
                  if (selected) void releases.setStatus(selected.id, status)
                }}
                onPublish={() => {
                  if (selected) void releases.publish(selected.id)
                }}
                onUnpublish={() => {
                  if (selected) void releases.unpublish(selected.id)
                }}
                onDelete={() => {
                  if (selected) requestDelete(selected)
                }}
              />
            </div>
          </>
        )}
      </main>

      {creating ? (
        <NewReleaseDialog
          existingVersions={allReleases.map((release) => release.version)}
          baseVersion={currentRelease?.version ?? allReleases[0]?.version ?? null}
          onCancel={() => setCreating(false)}
          onCreate={handleCreate}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsPanel
          settings={settings}
          publisher={publisher}
          onClose={() => setSettingsOpen(false)}
          onSave={(next) => {
            setSettings(next)
            saveSettings(next)
            notify('Settings saved')
          }}
          onRefresh={() => {
            releases.reload()
            setSettingsOpen(false)
          }}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title={`Delete ${pendingDelete.version}?`}
          message={
            pendingDelete.publishedToWebsite
              ? `This removes ${pendingDelete.version} from the version history and from the vClyps website. It cannot be undone.`
              : `This removes ${pendingDelete.version} from the version history. It cannot be undone.`
          }
          confirmLabel="Delete release"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void releases.deleteRelease(pendingDelete.id)
            setPendingDelete(null)
          }}
        />
      ) : null}

      <Toast notice={notice} />
    </div>
  )
}

function LoadingState() {
  return (
    <div className="state" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading releases</span>
      <div className="skeleton" style={{ width: 120, height: 11 }} />
      <div className="skeleton" style={{ width: 260, height: 62, maxWidth: '80vw' }} />
      <div className="skeleton" style={{ width: 200, height: 13 }} />
    </div>
  )
}
