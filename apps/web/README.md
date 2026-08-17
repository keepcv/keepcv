# @keepcv/web

The browser app for [KeepCV](https://github.com/keepcv/keepcv). Not published:
the `keepcv` launcher serves the built output, on the same origin as the API.

> **Status: early development.** Read-only so far - the application frame, the
> store overview, records, points, resumes with a compiled preview, and search.
> Editing, the point and phrasing editor and dragging a resume into shape
> follow.

## Running it

The launcher serves the built app and the API together, which is the arrangement
the app is designed for:

```sh
pnpm build && node apps/cli/dist/index.js serve
```

It prints a URL with the session token in the fragment. Open that one - the app
has no other way to get a token, and one is minted per launch.

For a dev server with hot reload, leave a launcher running and start Vite beside
it. `/v1` is proxied through, so the app still sees one origin:

```sh
pnpm --filter @keepcv/web dev
```

## How it is put together

- **One request boots it.** `GET /v1/store` returns the whole store - kilobytes,
  archived rows included - and every screen reads from that cache through
  selectors. There is no sync engine and there will not be one.
- **Counting and filtering live in `@keepcv/core`**, which runs unchanged in the
  browser. A nudge like "this point has no metric" is a pure function there, so
  the browser, the CLI and anything server-side give the same answer.
- **Formatting lives here**, in each feature's `model/`. A date range is
  presentation; putting it on the DTO would make the wire contract a UI
  changelog.
- **Filters live in the URL.** `/records?kind=experience&archived=only` is a view
  you can bookmark and come back to, which is the whole point of a store you
  return to after ninety days.
- **Archived content is reachable, never hidden.** The toggle filters rows the
  client already holds, so "where did my old entry go" is answered without a
  request.
- **Errors are typed.** The API answers RFC 9457, so a failure renders a problem
  rather than a parsed string.

## The session token

The launcher prints it in the URL fragment, which no browser sends to any
server. The app claims it once, keeps it in `sessionStorage` for the tab, and
strips it from the address bar. A page on another origin that fetches this one
gets the entry document with no token in it.

## Licence

MIT
