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
in. Keep the client, query cache and callback stable while mounted. Unmount and
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
provide all four fields, keeping the object stable while mounted:

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
SVG and system fonts. The bundled DOCX worker is in `dist/assets` and remains
relative to the module; preserve it when copying package files. A bundler such
as Vite copies it into the consumer output.

For dark mode before first paint, copy the exported `@keepcv/editor/theme.js`
asset to a same-origin URL and load it with a blocking `<script src="/theme.js">`
in the HTML head. The editor follows the stored choice after mount.

`@keepcv/editor/ui` exports the Icon, Spot, Button, TextField and Kbd primitives
used by the local app's entry screens, plus the GlyphName type.

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
contextual panel. To make Overview the home while keeping the assistant, pass
`home="overview"`. The assistant then lives at `/assistant`. To hide generation
presentation, use:

```tsx
<Editor api={api} queries={queries} assistant={false} home="overview" />;
```

`assistant={false}` sends `/` to `/overview` regardless of `home`; direct
`/assistant` navigation opens `/conversations`. It hides the assistant navigation,
contextual panel, composer, suggestions and task permission controls. Conversations
remains in navigation and at `/conversations`, with saved messages, exact proposal
history, receipts, original attachment downloads and archive/restore. This route
is available with either presentation setting. Set these options before mounting;
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
