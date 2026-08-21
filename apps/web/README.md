# @keepcv/web

The browser app for [KeepCV](https://github.com/keepcv/keepcv). Not published:
the `keepcv` launcher serves the built output, on the same origin as the API.

> **Status: early development.** The application frame, the store overview,
> records and points with the forms that write them, the phrasing editor with
> its drafts and variants, resumes you can start, compose, template, preview,
> compare and restore from, and search. Tags, evidence and a resume's target
> context are still read-only.

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
- **Writes are optimistic, and a conflict is never resolved for you.** Ids are
  minted in the browser, so the row on the screen is the row the store ends up
  with; if the store refuses the write, the cache goes back. A `409` shows what
  each side says, field by field, and saves nothing until you pick one.
- **Nothing is deleted.** Archiving is the only removal, and it reverses from the
  same button.
- **Rewording a point appends.** A commit sends a new revision and moves a
  pointer, so a resume you sent in March goes on saying what it said. Retyping a
  word and undoing it sends nothing at all.
- **Keystrokes are kept outside history.** What you type is saved as a draft
  after a pause and becomes a revision only when you stop - on blur, or after
  thirty seconds idle. Close the tab mid-sentence and the words are waiting next
  time, offered rather than restored.
- **A point can say the same thing several ways.** A set holds a standard
  wording plus short, long or angled variants, and points at one of them. A
  resume pins the wording it chose, so changing which is canonical rewrites
  nothing that was already sent.
- **Composing a resume costs one small request per change.** A toggle, a move or
  a placement writes one row, and the answer goes straight into the cache rather
  than sending the whole store back down the wire.
- **Taking something off a resume puts it back where it was.** Removing is
  archiving, so adding the same record again revives the row that is already
  there - with its position, its visibility and the wording it had chosen.
- **A template renders the preview, in a document of its own.** The page is an
  iframe the app's stylesheet cannot reach, laid out at the size it will print
  at and scaled to fit. Picking a template and tuning its typeface, size, line
  height and margins are writes on the resume, so a version captured afterwards
  records the one it was sent under. Only what differs from the template's own
  defaults is stored, and what the template says about itself is an observation,
  not a claim that some product accepts it.
- **The preview says how long it is, and what will not fit.** Tell a resume how
  many pages it may run to and it says whether it does, marks where each page
  begins, and names what sits past the break - which entries and which points, so
  the answer to "it is too long" is something to act on rather than a number. The
  page count comes from measuring the page the template actually laid out, not
  from guessing at the text.
- **A resume remembers what it said.** Every version is kept, any two can be
  compared, and restoring one puts its selection back without erasing what came
  after: the restore is a new entry on the timeline saying where it came from. It
  restores which points were on the resume and in what order - not their words,
  which the version keeps and the point's own history holds. Star one to give it
  a name you will recognise later.

## The session token

The launcher prints it in the URL fragment, which no browser sends to any
server. The app claims it once, keeps it in `sessionStorage` for the tab, and
strips it from the address bar. A page on another origin that fetches this one
gets the entry document with no token in it.

## Licence

MIT
