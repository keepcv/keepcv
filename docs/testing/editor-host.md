# Editor host integration verification

Use only synthetic career content and public package entries. Provider credentials,
authentication, accounting and service policy belong to the host.

## Installed consumer

Run `pnpm check` and `DATABASE_URL=postgres://... pnpm release:check` (set the
environment variable through PowerShell on Windows). The release check builds
and packs the actual libraries, installs outside the workspace, typechecks the
public Editor entry, builds a Vite consumer and exercises its real typed API.
The hosted fixture in fixtures/editor-consumer mounts the editor below a variable
notice/header. It uses finite-parent sizing, Account settings and recovery links,
separate connected caches/recovery namespaces and the shared composer. Its static
host pages are examples, not an authentication implementation.

Verify these paths in a browser served with same-origin assets:

- Toggle the notice before/after typing and selecting files. Drafts, file choices,
  page context, web preference, router and supplied query cache must survive.
- Test default viewport and container sizing at 1280 x 800, 390 x 550 and
  390 x 390. Expand/collapse the rail; open the mobile sheet, History and settings.
  Send, Stop and tools stay reachable and menus escape scroll containers.
- First Send and Ctrl/Cmd+Enter refresh capabilities and show the sharing Dialog.
  Read the server disclosure, selected-file scope and web choice. Web opt-out
  takes effect without another approval step. Cancel/Escape returns focus to
  the composer, retains text/files/originals/context and creates/uploads nothing.
- Allow and send creates one intended turn. Repeated clicks/shortcuts do not
  duplicate it. New chats retain acknowledgment; remount/reload or a connection
  change starts fresh. Change the server disclosure/formats while mounted;
  the next send must ask again without discarding the draft.
- Revoke future sharing in settings during an active task. The UI explains that
  it continues and exposes separate Stop. Never claim provider data was retracted.
- Refuse generation or expire the session while consent is open. A stale dialog
  must not submit. Verify 401, 403, 429 with Retry-After, 503, malformed bodies,
  offline transport and interrupted streams. Host recovery actions receive typed
  status when present; unknown/legacy failures keep safe message context only.
  No recovery action replays a write or enables a feature automatically.
- Advertise text-only, images without PDF, PDF without images, mixed and no-file
  capabilities. The chooser/drop checks and sharing/settings copy follow that
  set. Text aliases normalize to UTF-8 text. Recheck detected media on the server;
  renamed image bytes must not bypass text-only generation policy. Historical
  originals/downloads remain available regardless of current generation support.

The isolated tests run false/missing disclosure, detected media refusal, owned
original downloads, native archive retention and text-only generation on both
PGlite and server PostgreSQL when DATABASE_URL is supplied. Existing runtime
owner/revocation/lease/receipt tests remain required; no automatic replay is added.

## Browser workers and assets

Import a synthetic PDF and DOCX and confirm both reach import review with the
expected name and record. This is independent of assistant PDF generation.
Inspect network requests: PDF uses the packaged, exact-version PDF.js module
worker; DOCX uses the existing bundled module worker. Serve `.mjs` as JavaScript
with nosniff. Verify a host-selected Vite asset base as well as root assets.
Keep editor navigation at the origin root and serve its entry for deep links;
asset relocation does not add nested-router support.

Use `script-src 'self'; worker-src 'self'` with the application's existing
same-origin connection/image/style/frame policy. No CDN or broader worker policy
is needed. PDF.js parser and worker are pinned together; copying a worker from
another installed version is unsupported. The package build checks both worker
assets, compiled CSS and favicon export. The installed launcher smoke test fetches
every worker over HTTP and checks JavaScript MIME, nosniff and exact bytes. The favicon follows system light/dark
preference; the separate theme script handles stored editor theme before paint.

No migration or native archive version change is introduced. Error stream events
retain their names and text, adding optional safe Problem/Retry-After metadata.
Historical errors without that metadata are not reconstructed as typed refusals.
Presentation ports never enforce server access or gate ordinary editing/export.
