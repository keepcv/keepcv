# @keepcv/web

The local browser entry for KeepCV. It discovers launcher authentication,
claims the session token, shows entry screens and mounts
[`@keepcv/editor`](../../packages/editor/README.md) with the typed API client,
QueryClient and optional sign-out callback. It uses the editor's compiled styles
and assets. The launcher serves this private app alongside the API.

## Running it

Follow [local development](../../CONTRIBUTING.md#run-and-validate-locally) to
build and start the launcher with a scratch store. Open its printed URL,
including the token fragment.

For hot reload, leave that launcher running on port 4319 and run:

```sh
pnpm --filter @keepcv/web dev
```

Vite proxies `/v1` to the launcher so the app sees one origin.

## Authentication

The launcher prints a per-launch token in the URL fragment, which browsers do
not send to servers. The app claims it once, keeps it in the tab's
`sessionStorage` and removes it from the address bar. A page on another origin
fetching the entry document receives no token.

See [launcher authentication](../../docs/architecture/api-contract.md#6-serving-it-yourself)
for token, password and proxy modes and the entry-screen behavior.

## Editor behavior

- [User guide](../../docs/TEMPLATES.md): templates, Design and export.
- [Application Structure](../../docs/architecture/application-structure.md):
  cached-store selectors, optimistic writes, recovery, screens and preview.
- [Data Model](../../docs/architecture/data-model.md): records, points, phrasing
  revisions, private evidence, tags, composition and history.
- [Capabilities](../../docs/architecture/capabilities.md): delivered behaviors,
  import/export, readability checks and non-goals.

## Licence

MIT - see [LICENSE](../../LICENSE).
