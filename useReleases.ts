import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Release, ReleaseInput, ReleaseStatus } from './release'
import { findCurrentRelease, sortReleases, toPublicRelease } from './release'
import type { ReleaseRepository } from './releaseRepository'
import type { WebsitePublisher } from './publishing'
import { PublishError } from './publishing'

export type LoadState = 'loading' | 'ready' | 'error'

export interface ReleasesApi {
  releases: Release[]
  currentRelease: Release | null
  loadState: LoadState
  loadError: string | null
  reload: () => void
  createRelease: (input: ReleaseInput) => Promise<Release | null>
  updateRelease: (id: string, patch: Partial<ReleaseInput>) => Promise<void>
  setStatus: (id: string, status: ReleaseStatus) => Promise<void>
  deleteRelease: (id: string) => Promise<void>
  publish: (id: string) => Promise<void>
  unpublish: (id: string) => Promise<void>
  busyId: string | null
}

/**
 * Owns all release state. Components read from here and call back into it;
 * they never touch the repository or the publisher directly.
 *
 * Writes are sent to the server first and local state is replaced with what
 * comes back, so the screen always shows what is actually stored.
 */
export function useReleases(
  repository: ReleaseRepository,
  publisher: WebsitePublisher,
  onNotify: (message: string, tone?: 'ok' | 'error') => void,
): ReleasesApi {
  const [releases, setReleases] = useState<Release[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const releasesRef = useRef(releases)
  releasesRef.current = releases

  const load = useCallback(async () => {
    setLoadState('loading')
    setLoadError(null)
    try {
      setReleases(await repository.list())
      setLoadState('ready')
    } catch (error) {
      setLoadError(message(error, 'Could not load releases.'))
      setLoadState('error')
    }
  }, [repository])

  useEffect(() => {
    void load()
  }, [load])

  /** Slots a single updated release back into the list. */
  const replaceOne = useCallback((updated: Release) => {
    setReleases((current) =>
      sortReleases(current.map((release) => (release.id === updated.id ? updated : release))),
    )
  }, [])

  const createRelease = useCallback(
    async (input: ReleaseInput): Promise<Release | null> => {
      try {
        const created = await repository.create(input)
        setReleases((current) => sortReleases([...current, created]))
        onNotify(`${created.version} created`)
        return created
      } catch (error) {
        onNotify(message(error, 'Could not create the release.'), 'error')
        return null
      }
    },
    [repository, onNotify],
  )

  const updateRelease = useCallback(
    async (id: string, patch: Partial<ReleaseInput>) => {
      try {
        replaceOne(await repository.update(id, patch))
        onNotify('Saved')
      } catch (error) {
        onNotify(message(error, 'Could not save changes.'), 'error')
        // Re-read so the screen does not keep showing a rejected edit.
        void load()
      }
    },
    [repository, replaceOne, onNotify, load],
  )

  const setStatus = useCallback(
    async (id: string, status: ReleaseStatus) => {
      try {
        // Promoting demotes another release, so the server returns the whole list.
        setReleases(await repository.setStatus(id, status))
        onNotify('Status updated')
      } catch (error) {
        onNotify(message(error, 'Could not update the status.'), 'error')
        void load()
      }
    },
    [repository, onNotify, load],
  )

  const deleteRelease = useCallback(
    async (id: string) => {
      const target = releasesRef.current.find((release) => release.id === id)
      setBusyId(id)
      try {
        // Keep the website in step: a deleted release must not stay live.
        if (target?.publishedToWebsite) {
          try {
            await publisher.unpublish(id)
          } catch {
            onNotify('Removing the website entry failed; deleting locally anyway.', 'error')
          }
        }
        await repository.remove(id)
        setReleases((current) => current.filter((release) => release.id !== id))
        onNotify(`${target?.version ?? 'Release'} deleted`)
      } catch (error) {
        onNotify(message(error, 'Could not delete the release.'), 'error')
      } finally {
        setBusyId(null)
      }
    },
    [repository, publisher, onNotify],
  )

  const publish = useCallback(
    async (id: string) => {
      const target = releasesRef.current.find((release) => release.id === id)
      if (!target) return

      setBusyId(id)
      try {
        // Only the public projection crosses this boundary.
        const receipt = await publisher.publish(toPublicRelease(target))
        replaceOne(await repository.setPublished(id, receipt.publishedAt))
        onNotify(`${target.version} published to website`)
      } catch (error) {
        onNotify(
          error instanceof PublishError ? error.message : message(error, 'Publishing failed.'),
          'error',
        )
      } finally {
        setBusyId(null)
      }
    },
    [repository, publisher, replaceOne, onNotify],
  )

  const unpublish = useCallback(
    async (id: string) => {
      const target = releasesRef.current.find((release) => release.id === id)
      setBusyId(id)
      try {
        await publisher.unpublish(id)
        replaceOne(await repository.setPublished(id, null))
        onNotify(`${target?.version ?? 'Release'} removed from website`)
      } catch (error) {
        onNotify(message(error, 'Could not reach the website.'), 'error')
      } finally {
        setBusyId(null)
      }
    },
    [repository, publisher, replaceOne, onNotify],
  )

  const currentRelease = useMemo(() => findCurrentRelease(releases), [releases])

  return {
    releases,
    currentRelease,
    loadState,
    loadError,
    reload: () => void load(),
    createRelease,
    updateRelease,
    setStatus,
    deleteRelease,
    publish,
    unpublish,
    busyId,
  }
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
