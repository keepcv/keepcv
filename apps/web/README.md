# @keepcv/web

The browser app for [KeepCV](https://github.com/keepcv/keepcv). Not published:
the `keepcv` launcher serves the built output, on the same origin as the API.

> **Status: early development.** The application frame, the store overview,
> records and points with the forms that write them, the phrasing editor with
> its drafts and variants, private evidence, the tag vocabulary, and resumes you
> can start, compose, target, template, preview, compare, restore from and send
> as a file, plus search. Every collection the store holds now writes.

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
- **What backs a claim up stays here.** A point takes the link, the note or the
  file that proves it, and no resume can carry any of it - not because a filter
  strips it, but because the compiled document has no field it would fit in. It
  is in the export, though: a backup that quietly dropped it would not be a
  backup.
- **A tag is made by using the word.** Type it on a record or a point and it is
  created and filed in one motion; type one you already have, however you spell
  it, and it reaches for that one rather than making a second. The vocabulary
  screen is where you rename, merge and put aside - and merging carries
  everything the old name held onto the new one, so consolidating eighty tags
  down to twenty loses nothing.
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
- **A resume knows what job it is for, and says how well it answers it.** Paste
  the posting and it names the terms the posting leans on, marks which of them
  anything you placed actually answers, and lists the points that answer least -
  each with the job it sits under, and a way to take it off the page without
  deleting it. The matching is deliberately plain: word frequency against a list
  of the phrases every posting uses, and nothing that needs sending anywhere. It
  will miss a match before it invents one, so the words are there to be checked
  rather than trusted.
- **A resume remembers what it said.** Every version is kept, any two can be
  compared, and restoring one puts its selection back without erasing what came
  after: the restore is a new entry on the timeline saying where it came from. It
  restores which points were on the resume and in what order - not their words,
  which the version keeps and the point's own history holds. Star one to give it
  a name you will recognise later.
- **A finished resume leaves as one file.** Download it as HTML that carries its
  own styling and fetches nothing, or print it - which is the PDF, because the
  page size, the margins and the breaks are already in the file and your
  browser's print engine is what lays them out. Both are written from what the
  tab already holds, so neither asks the store for anything, and nothing marked
  private can travel in either.

## The session token

The launcher prints it in the URL fragment, which no browser sends to any
server. The app claims it once, keeps it in `sessionStorage` for the tab, and
strips it from the address bar. A page on another origin that fetches this one
gets the entry document with no token in it.

## Licence

MIT
