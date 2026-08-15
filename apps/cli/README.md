# keepcv

Run [KeepCV](https://github.com/keepcv/keepcv) on your own machine. A career
data store that compiles into resumes: the store holds everything permanently,
and a resume is a selection over it.

> **Status: early development.** There is no release yet, and no UI - what this
> serves today is the HTTP API.

## Usage

```sh
npx keepcv serve
```

It opens the store, runs any pending migrations, mints a session token for this
launch and prints where everything is:

```
  KeepCV is running.

    URL     http://127.0.0.1:4319
    Store   /home/ada/.keepcv
    Token   RmXk...
```

```sh
curl -H "x-keepcv-session: $TOKEN" http://127.0.0.1:4319/v1/profile
```

The contract is at `/v1/openapi.json`, which needs no token.

### Options

| Option | Default |
|---|---|
| `--port <number>` | `4319` |
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
