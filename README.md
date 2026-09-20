# vClyps Release Manager

Internal tool for managing vClyps app versions, release notes, and what gets
published to the vClyps website's update log.

It does four things and deliberately nothing else:

1. Show the current production version
2. Keep the version history
3. Write release notes (public) and internal notes (private)
4. Publish selected releases to the website's update log

## Running it

Needs **Node.js 18.18 or newer** (`node -v` to check).

```bash
npm install
npm run dev     # http://localhost:5173
```

There is nothing to configure — the Supabase project details are built into
`src/supabaseClient.ts`.

`index.html` cannot be opened straight from disk: it is the shell for a Vite
app and needs the dev server to compile `src/main.tsx`. Open it directly and
the page now tells you so rather than showing a black screen.

Other scripts:

```bash
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
npm test           # unit tests
npm run typecheck
```

## How it is put together

Everything lives directly in `src/` — one flat folder, no nesting. The
layering is in the dependencies between files, not in the directory tree.

```
src/
  main.tsx                 Entry point
  App.tsx                  Screen composition and dialog state
  styles.css               All styling

  release.ts               Types, validation, version bumps, and the public
                           projection. No React, no storage, no network.
  release.test.ts

  useReleases.ts           All release state and actions

  supabaseClient.ts        Client + built-in project configuration
  releaseRepository.ts     ReleaseRepository interface + Supabase impl
  releaseRow.ts            Database row <-> domain mapping
  settings.ts              Publishing target and UI preferences
  storage.ts               localStorage wrapper (UI preferences only)

  publishing.ts            WebsitePublisher interface + the factory that
                           picks one based on settings
  supabasePublisher.ts     Publishes to the Supabase update log (default)
  httpPublisher.ts         The real website API, ready to switch on
  mockPublisher.ts         Offline stand-in, not wired up by default
  publisher.test.ts

  Masthead.tsx             The interface, one component per file
  CurrentVersion.tsx
  VersionHistory.tsx
  ReleaseDetail.tsx
  NewReleaseDialog.tsx
  SettingsPanel.tsx
  EditableVersion.tsx
  VersionBumpButtons.tsx
  BulletEditor.tsx
  Modal.tsx
  ConfirmDialog.tsx
  StatusPill.tsx
  Toast.tsx
  icons.tsx
```

Components never touch storage or the network. They read from `useReleases`
and call back into it.

### `local-only/`

Everything that is not needed to run the app sits in `local-only/`, which
`.gitignore` keeps off GitHub: the database migration SQL and a copy of the
old `.env`. See [`local-only/README.md`](local-only/README.md).

### The release model

```ts
interface Release {
  id: string
  version: string            // user-controlled, no semver rules imposed
  releaseDate: string        // YYYY-MM-DD
  status: 'production' | 'previous' | 'draft'
  releaseNotes: string[]     // public bullets
  internalNotes: string      // never published
  publishedToWebsite: boolean
  publishedAt: string | null
}
```

### Versions: suggested, never enforced

**New Release** opens with the version already filled in as a patch bump of
the current release, and offers major / minor / patch shortcuts:

```
From v0.8.2   [ Major v1.0.0 ]  [ Minor v0.9.0 ]  [ Patch v0.8.3 ]
```

The shortcuts only fill the field — they never save on their own and never
constrain what can be stored. The field stays free text, so `v0.9`,
`v1.0.0-rc.1`, `v2.4.7` or a jump backwards are all still accepted. Validation
rejects only input that is obviously broken: empty, no digits, over 32
characters, unparseable punctuation, or a duplicate.

`bumpVersion()` pads short versions to three parts (`v0.9` patches to `v0.9.1`),
drops a pre-release suffix (`v1.0.0-rc.1` patches to `v1.0.1`), keeps the
prefix exactly as written, and returns null when there is nothing numeric to
bump — in which case only manual entry is offered.

Click any version number to edit it in place. **Enter** saves, **Escape**
cancels. Clicking away saves a valid edit and reverts an invalid one, so a
typo can never trap focus in the field.

### Public and internal notes

`toPublicRelease()` in `src/release.ts` is the single point where a release
becomes website-facing data:

```ts
interface PublicRelease {
  id: string
  version: string
  releaseDate: string
  notes: string[]
}
```

`internalNotes` is structurally absent from that type, and `WebsitePublisher`
only accepts a `PublicRelease` — so internal notes cannot reach the website by
forgetting to strip them at a call site. Tests cover this in
`src/release.test.ts` and `src/publisher.test.ts`.

### Where the data lives

Everything is in Supabase — project **vclyps**, `ap-southeast-1`. Nothing is
stored in the browser except two UI preferences (publishing target and the
delete-confirmation toggle), so the whole team sees the same history.

```
public.releases             the internal record, including internal_notes
public.website_update_log   what the public site serves
```

`website_update_log` has **no column for internal notes**, so the public and
internal split is enforced by the database schema rather than only by
application code. Two more rules are enforced in Postgres:

- `releases.version` is unique
- a partial unique index allows only one release in `production` at a time

Promoting a release therefore has to demote the current one in the same
transaction, which is what the `set_release_status` and `create_release`
functions do.

Row-level security is on, with policies that allow the publishable key to read
and write — the app has no sign-in, as requested. Note that `internal_notes`
lives on `releases`, so anyone holding the key can read it, and the key is
readable by anyone who can open the app or this repository. To make internal
notes private later, drop the anon policies on `releases` and serve the public
site from `website_update_log` alone.

### Connecting the real website API

Publishing goes to the Supabase update log by default. Open
**Settings → Website update log** to see exactly what the website would serve.

`HttpWebsitePublisher` is already written against these endpoints:

```
PUT    {baseUrl}/update-log/{id}    upsert, body: PublicRelease
DELETE {baseUrl}/update-log/{id}    remove
GET    {baseUrl}/update-log         UpdateLogEntry[]
```

Set **Settings → Website API base URL** to switch over. Nothing else in the
app changes. If the real endpoints end up shaped differently,
`src/httpPublisher.ts` is the only file that has to move.

The same seam exists for release storage: swap `SupabaseReleaseRepository` in
`src/App.tsx` for any other `ReleaseRepository`.

## Behaviour worth knowing

- Only one release is in production at a time. Promoting one demotes the
  previous production release rather than leaving two live versions.
- Deleting a published release also removes it from the website.
- Publishing requires at least one public note.
- Deletion asks for confirmation (switchable in Settings).
- Releases persist in Supabase; **Settings → Reload from Supabase** picks up
  changes made by someone else.

## Keyboard

| Key | Where | Action |
| --- | --- | --- |
| `Enter` | version field | Save |
| `Escape` | version field | Cancel the edit |
| `Tab` | version field | Reach the major/minor/patch shortcuts |
| `Escape` | detail pane, dialogs | Close |
| `↑` `↓` `Home` `End` | version history | Move between releases |
| `Enter` | version history | Open the focused release |
| `Enter` | release note | Add the next bullet |
| `Backspace` | empty release note | Remove it and step back |
| `Tab` | dialogs | Focus stays inside |

## Notes

- Inter and JetBrains Mono load from Google Fonts. If that is unreachable
  (offline, locked-down network), the app falls back to the system font stack
  and still looks correct.
- Runtime dependencies are React, React DOM and `@supabase/supabase-js`.
- The Supabase publishable key is committed on purpose: it identifies the
  project, carries no privileges of its own, and is compiled into the
  JavaScript bundle regardless. Access is governed by the row-level security
  policies above, not by hiding the key.
