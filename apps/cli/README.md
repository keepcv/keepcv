# keepcv

Run [KeepCV](https://github.com/keepcv/keepcv) on your own machine. A career
data store that compiles into resumes: the store holds everything permanently,
and a resume is a selection over it.

> **Status: early development.** There is no release yet. It serves the HTTP API
> and the web app, and writes a resume out as a file.

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
| `--data-dir <path>` | `~/.keepcv` |

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

| Option | Default |
|---|---|
| `--out <path>` | the resume's own name, in the current directory |
| `--data-dir <path>` | `~/.keepcv` |

The data directory is where your career store lives. It is a PostgreSQL
database - real PostgreSQL, compiled to WebAssembly, running in-process with no
Docker and no daemon - and it is yours: `GET /v1/export` hands the whole thing
back losslessly and is never gated by anything.

The server binds to loopback only. This is a personal store, and nothing in it
is built to face a network.

The session token is minted per launch and held in memory, so it changes every
time and never lands on disk.

## Licence

MIT
