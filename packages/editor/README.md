# @keepcv/editor

The KeepCV browser editor: records, Points, phrasings, resumes, templates,
search, import and export. The local web app mounts this same package.

```sh
pnpm add @keepcv/editor @keepcv/api @tanstack/react-query react react-dom
```

```tsx
import { createClient } from "@keepcv/api";
import { Editor } from "@keepcv/editor";
import { QueryClient } from "@tanstack/react-query";
import "@keepcv/editor/style.css";

const api = createClient(window.location.origin);
const queries = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

export function App() {
  return <Editor api={api} queries={queries} signOut={() => {
    queries.clear();
    window.location.assign("/");
  }} />;
}
```

The caller supplies authentication through the typed client and decides what
signing out does. Omit `signOut` to hide the control. Mount only after signing
in. Keep the client and query cache stable while mounted. Unmount and
clear the cache before changing owners; use a fresh QueryClient for each owner.
The editor uses `['store']` and the documented history keys in that cache.

Pass `recoveryNamespace` when the same origin can connect to different stores:

```tsx
<Editor api={api} queries={queries} recoveryNamespace={connectedStoreKey} />;
```

Use a stable, opaque string identifying the connected store, chosen by the
caller from its trusted connection context. Different stores need different
namespaces even when imported ids match. Keep it stable while mounted; unmount
and use a fresh query cache when switching stores. Pending wording, template
designs, resume settings and explicit-save forms remain with their original namespace through
sign-out and failed saves, and recover when that store is reopened.

Job target (Company, Role, Posting, Applied on and Job description), Profile,
Record, Point creation and placement, metrics, Evidence, record links/fields
and contact forms retain unfinished values locally
before validation or sending. Reopening the form restores its inputs for an
explicit Save; it never sends them automatically. Refusals leave the inputs
and recovery copy intact. Navigation and sign-out retain them; Revert, Cancel
on sub-collection controls, or keeping the stored side of a conflict discard
that form's copy explicitly. Record/Point route Cancel keeps recovery; use
Revert to discard it. Only an acknowledged Save clears the submitted copy;
newer edits survive an earlier acknowledgment. Recovered updates retain the
original concurrency token so changed server values still require a comparison.
Browser recovery is absent from native backups and rendered resumes. Browser
storage must be available for recovery across remounts; a storage refusal never
blocks a Save or removes visible input.

Omitting the namespace retains standalone recovery, including existing
unscoped edits. A supplied namespace never reads, migrates or removes those
legacy copies: their store cannot be inferred safely. Recover them through the
original standalone connection. Browser keys are internal and are not a
consumer contract. Theme and navigation preferences remain shared. A namespace
separates recovery; it is not an authorization boundary for same-origin code.

`dataPage` configures the explanatory text on Your data. Omit it for the
standalone launcher's guidance. For an API with another storage location,
provide all four fields:

```tsx
import type { DataPagePresentation } from "@keepcv/editor";

const dataPage: DataPagePresentation = {
  storageDescription: "Your career data is saved by the connected application.",
  backupDescription: "Download a backup to keep a copy you control.",
  restoreDescription: "Restore a backup into an empty store in the connected application.",
  showTerminalInstructions: false,
};

<Editor api={api} queries={queries} dataPage={dataPage} />;
```

This changes guidance only. Browser backup includes archived content, wording
revisions, and resume history. Restore still refuses a non-empty store. Setting
`showTerminalInstructions` to `false` omits that card and its accessible content.

This is a browser application at the origin root. Serve the entry HTML for
editor navigation paths such as `/records` and `/resumes`. It owns browser
history while mounted. Its public declaration does not register a router type
in the caller's application. Server rendering and embedding in another router's
route tree are outside this entry's contract.

Import the compiled `style.css`; no Tailwind build or source scanning is
required. It includes the semantic tokens and a document-wide reset. Icons use
SVG and system fonts. The PDF import worker comes from the version-aligned public
`@keepcv/interop/pdf.worker.mjs` entry and is configured automatically. Consumers
no longer need direct PDF.js imports or workerSrc boot code. The bundled DOCX worker is in `dist/assets` and remains
relative to the module; preserve it when copying package files. A bundler such
as Vite copies it into the consumer output.

For dark mode before first paint, copy the exported `@keepcv/editor/theme.js`
asset to a same-origin URL and load it with a blocking `<script src="/theme.js">`
in the HTML head. The editor follows the stored choice after mount.

`@keepcv/editor/ui` exports Logo, Icon, Spot, Button, TextField and Kbd, plus
the GlyphName and SpotName types. The shared Index Drawer logo uses inline
SVG and vector lettering. `<Logo />` is decorative inside a named link;
`<Logo label="KeepCV" />` names a standalone logo. Use `mark` for the symbol
alone, and `className` to size it. Its colors follow the compiled theme.
Spot includes store, composition, versions and snapshot artwork; the starred
`snapshot` art is distinct from automatic `versions`.

`pnpm release:check` installs packed artifacts outside the workspace and builds,
typechecks and tests `fixtures/editor-consumer`. It checks the emitted CSS and
worker, keyboard palette navigation, profile writes, the supplied query cache,
sign-out, refused authentication, both data-page presentations, native backup,
refusal to restore over existing content, scoped edit recovery, and configurable
unexpected-error reporting.

MIT.

The template library offers Default (visual) and HTML builders. HTML editing uses
a lazy code workspace, local files/assets, a selected-data explorer and explicit
save with scoped recovery. Preview/export use a packaged worker and a script-free
iframe. The library's system definitions are read-only; copied and imported
templates belong to the connected user. See [the template guide](../../docs/TEMPLATES.md).

## Assistant presentation

Existing consumers open the assistant at `/` and retain its navigation and
Ask KeepCV shortcut. To make Overview the home while keeping the assistant, pass
`home="overview"`. The assistant then lives at `/assistant`. To hide generation
presentation, use:

```tsx
<Editor api={api} queries={queries} assistant={false} home="overview" />;
```

`assistant={false}` sends `/` to `/overview` regardless of `home`; direct
`/assistant` navigation opens `/conversations`. It hides the assistant navigation,
Ask KeepCV shortcut, composer, suggestions and task permission controls. Conversations
remains in navigation and at `/conversations`, with saved messages, exact proposal
history, receipts, original attachment downloads and archive/restore. This route
is available with either presentation setting. With assistance enabled,
`/conversations` redirects to `/assistant`: the unified workspace includes
searchable History, with archive/restore and original
downloads. There is one Assistant navigation entry. Set these options before mounting;
unmount, clear the query cache and revoke server authority when changing identity.

These options are presentation only. Enforce authorization on the server through
the injected runtime and API boundaries. Omitting the model runtime disables
generation but leaves conversation creation and attachment storage routes enabled.
Capabilities report generation `available` separately from `historyAvailable` and
include the effective upload, text and turn limits. The composer uses those limits;
the server remains authoritative. Smaller new limits do not hide saved originals.

The installed editor consumer fixture demonstrates both settings using exported
package entry points, a custom model, trusted request scope and server refusal.


Stop reports a cancellation request rather than completion. If the server cannot
confirm a local controller for an unexpired running lease, its 409 expiry guidance
stays visible. The editor does not clear that lease or retry inference. Review
admission can expire or reach capacity; the server's fresh-task/review guidance
stays visible and existing conversation/receipt/file history remains accessible.

## Host composition and sharing

The default fills the viewport. Pass `sizing="container"` to fill a parent with
finite height; use `min-height: 0` on flex/grid ancestors. The host owns notices
and account chrome above that parent. Loading and failures use the same bounds.
The editor owns origin-root browser history in either mode.

```tsx
import type { HostAction } from "@keepcv/editor";

const hostActions: HostAction[] = [
  { id: "account", label: "Account settings", href: "/account" },
  { id: "help", label: "Help", onSelect: openHelp },
];

<div style={{ height: "70dvh", minHeight: 0 }}>
  <Editor api={api} queries={queries} sizing="container"
    recoveryNamespace={connectedStoreKey} hostActions={hostActions}
    recoveryActions={(failure) => failure.problem?.status === 401
      ? [{ id: "sign-in", label: "Sign in again", href: "/sign-in" }]
      : [{ id: "support", label: "Contact support", href: "/help" }]} />
</div>;
```

Host actions appear in System navigation, including the collapsed rail and
mobile sheet. Use unique stable ids and explicit labels. Links use ordinary
browser navigation to HTTP(S) destinations; callbacks receive no career data.
They do not enter the editor's internal route tree. Recovery actions receive
`EditorFailure`: message, optional typed `problem`, and optional `retryAfter`
containing the server's exact header value (seconds or HTTP date). Unknown and
legacy stream failures retain a message without invented status. Recovery
callbacks should be pure; actions are explicit and never replay requests.

Host presentation, actions and guidance can change while mounted without
recreating the router, replacing the cache or clearing composer input. Keep the
client, cache and recovery namespace stable for a connected owner. Replacing
one starts a fresh connected UI; hosts must still unmount, clear the old cache
and revoke server authority when changing owners or authenticated sessions.

Each valid send refreshes server capabilities before admission. A first Send or
Ctrl/Cmd+Enter opens a sharing dialog showing the current
server disclosure, shared input types and effective web choice. Not now/Escape
preserves all unsent input and makes no creation/upload/turn request. Allow and
send acknowledges and submits once. A changed pending draft requires a new send
intent. The acknowledgment lasts only for the connected editor lifetime; new
conversations retain it, remount/reload resets it. Changed service disclosure,
web scope or generation formats invalidates it. This is browser acknowledgment,
not a versioned server consent receipt or an edit grant.

Settings retains sharing control. Revocation blocks future sends; the active
task continues until the separate Stop action is acknowledged. Neither action
retracts provider data or undoes saved edits. Ordinary editing, history,
downloads and free export never require AI sharing.

Capabilities supply effective `generationMediaTypes` independently of stored
file formats. The chooser, drop validation, sharing dialog and file settings
follow that set. Markdown/JSON/CSV and other supported text aliases are UTF-8
`text/plain`, not separate parsers. Older servers/custom adapters without format
metadata default to text-only generation. Advertise qualified image/PDF types
explicitly to retain those inputs; saved originals remain downloadable.

Import `@keepcv/editor/favicon.svg?url` in a Vite consumer, or copy the exported
asset to a same-origin URL and use `<link rel="icon" href="/favicon.svg">`.
The SVG follows system light/dark preference and is MIT licensed with the package.
It needs no React serialization or source imports. The theme script remains a
separate pre-paint asset for the editor's stored theme preference.

The installed browser needs same-origin JavaScript module workers permitted by
`worker-src 'self'` and `script-src 'self'`. Serve `.js` and `.mjs` as JavaScript.
Vite copies PDF/DOCX workers relative to emitted assets, including a host-selected asset base. No CDN fallback, source maps or remote worker is needed.
This concerns import, independently of assistant PDF-generation capability.
