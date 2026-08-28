# keepcv

Run [KeepCV](https://github.com/keepcv/keepcv) on your own machine. A career
data store that compiles into resumes: the store holds everything permanently,
and a resume is a selection over it.

> **Status: early development.** There is no release yet. It serves the HTTP API
> and the web app, writes a resume out as a file, reports on what the store
> holds, and keeps a readable backup of the whole store beside it.

## Usage

```sh
npx keepcv serve
```

It opens the store, runs any pending migrations, mints a session token for this
launch and prints where everything is:

```
  KeepCV is running.

  Open this, token and all:

    http://127.0.0.1:4319/#token=RmXk...

    Store   /home/ada/.keepcv
    Backup  /home/ada/.keepcv/store.json
    Token   RmXk...
```

**Open the URL it prints, not the bare address.** The token is in the fragment,
which your browser keeps to itself and never sends to a server; the app takes it
from there once and remembers it for the tab. Opening `http://127.0.0.1:4319`
with no fragment gets you a page saying so.

The API is on the same address, under `/v1`:

```sh
curl -H "x-keepcv-session: $TOKEN" http://127.0.0.1:4319/v1/profile
```

The contract is at `/v1/openapi.json`, which needs no token.

### Options

| Option | Default |
|---|---|
| `--port <number>` | `4319` |
| `--host <address>` | `127.0.0.1` |
| `--data-dir <path>` | `~/.keepcv` |
| `--auth <mode>` | `token` |

`keepcv --help` lists every command, and `keepcv --version` says what is
installed.

## Looking at the store without opening it

```sh
npx keepcv status
```

It says what the store holds, where the backup is and how old it is, which of
the three sign-in modes will actually work, and anything the store can see is
unfinished - a role with no end date, a point carrying no metric, a
certification about to expire:

```
  Store
    /home/ada/.keepcv
    41 records, 118 points, 3 resumes
    6 archived, 1 design of your own

  Backup
    /home/ada/.keepcv/store.json
    212 kB, written 4 minutes ago

  Sign-in
    A password is set in /home/ada/.keepcv/auth.json, so --auth password works.

  Worth a look
    2 records with no end date
    Kubernetes Administrator expires 2026-11-02
```

Like every command here it opens the store, runs any pending migrations and
closes it again. It writes nothing else.

## Reaching it from somewhere else

The default is one person on one machine, and the launch token is exactly right
for that. It is wrong the moment the store has to be reachable from your phone,
your other laptop or a box in a cupboard: it is minted per run, printed to a
terminal and held in memory, so it changes on every restart and cannot be typed
in. `keepcv serve` refuses to bind off loopback with nothing but that token.

**A password.** Set one, then serve behind it:

```sh
npx keepcv set-password
npx keepcv serve --host 0.0.0.0 --auth password
```

The password is hashed with scrypt into `auth.json` in the data directory, mode
`0600`. Signing in sets a cookie that lasts thirty days and survives a restart.
Setting a password again ends every session there is. Sign-in is throttled to
five wrong answers a minute. Pipe it instead of typing it if you are scripting:
`echo "$PASSWORD" | npx keepcv set-password`.

**Or whatever is already in front of it.** If this is going behind Tailscale,
oauth2-proxy, Authelia, Cloudflare Access or a corporate gateway, let that thing
say who you are:

```sh
npx keepcv serve --auth proxy --proxy-header X-Forwarded-User
```

The header is read **only** from `--proxy-from`, which defaults to `127.0.0.1`.
Point it at your proxy if the proxy is elsewhere, because anything that can
reach the port directly can otherwise set that header itself. `--proxy-user`
pins the one value it may carry.

There is no account system here, and there will not be one. All three modes
answer the same single owner: this is your store, and the question is only
whether the request came from you.

## Writing a resume out

```sh
npx keepcv render "Staff engineer"
```

Any part of the name will do, as long as it names one resume; run it with no
name and it lists what the store holds. It writes one HTML file that carries its
own styling and fetches nothing, so it looks the same on a machine that has
never seen your store. Open it and print it to get a PDF: the page size, the
margins and the page breaks are all in the file already.

Nothing marked private travels in it. Evidence is not a field the resume
document has.

After it writes the file it reads it back the way a machine would and says what
it found: an email address nothing can extract, a heading no system looks for, a
date with no year in it, or a template that moves the words around on the page.
It is a report, not a gate - the file is already written.

It also writes the same resume as [JSON Resume](https://jsonresume.org), for
piping into whatever else you run:

```sh
npx keepcv render "Staff engineer" --format jsonresume
```

That format has a fixed set of lists and one string per highlight, so some of
what your store holds has nowhere to go in it. It counts what that costs
**against this resume** - three metrics, one section with nowhere to file it -
and says so after writing the file. Anything at zero is left out, because a
warning printed every time is one nobody reads.

It also writes the same selection as a page to put online:

```sh
npx keepcv render "Staff engineer" --format site
```

One self-contained HTML file - a header, one card per entry, a jump list between
sections, and a dark scheme if the reader's machine asks for one. It fetches
nothing, like the resume, and it is called `index.html`, which is what a static
host looks for and what stops it overwriting the resume beside it. There is no
lint report on that branch: the linter is about what a machine reading a resume
gets out of it, and nothing here is going to one.

It carries the contact details this resume carries. What a stranger sees is
decided when the resume is composed.

| Option | Default |
|---|---|
| `--format <name>` | `html`; `site` and `jsonresume` are the others |
| `--out <path>` | the resume's own name, or `index.html` for a page |
| `--data-dir <path>` | `~/.keepcv` |

## Backing it up

The launcher writes `store.json` beside the data directory as it starts, every
few minutes while it runs, and again as it stops. It is the whole store in one
readable file - archived rows, superseded wordings and every resume version -
written whole and moved into place, so a crash mid-write leaves the previous copy
rather than half a file. A write that would change nothing is skipped, so an idle
store touches no disk.

The same two things on demand:

```sh
npx keepcv backup --out my-store.json
npx keepcv restore --from my-store.json --data-dir ./fresh
```

A restore only loads into a store nothing has been written to yet. It never
merges two career histories: that needs a review step in front of it, which is
what the import screen in the app is for. It says which of three things went
wrong rather than throwing - no file there, not a KeepCV backup, or a store that
already holds something.

| Option | Default |
|---|---|
| `--out <path>` | `store.json` beside the store |
| `--from <path>` | required, for `restore` |
| `--data-dir <path>` | `~/.keepcv` |

The data directory is where your career store lives. It is a PostgreSQL
database - real PostgreSQL, compiled to WebAssembly, running in-process with no
Docker and no daemon - and it is yours: `GET /v1/export` hands the whole thing
back losslessly and is never gated by anything.

The server binds to loopback unless you tell it otherwise, and it will not go
further with nothing but a launch token.

That token is minted per launch and held in memory, so it changes every time and
never lands on disk. A password does land on disk, hashed; the secret that signs
sessions sits beside it, and rotating it is what ending every session means.

## Licence

MIT
