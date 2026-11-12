# Run KeepCV with Docker

The image contains Node, the launcher, web app and PGlite. No database service or
host Node installation is needed. Published images target Linux amd64; Docker
Desktop can run Linux containers on Windows/macOS. ARM hosts require emulation
or a native source build until ARM release validation is added.

## First launch

After the first container release, from a directory containing `compose.yaml`:

```sh
docker compose pull
docker compose run --rm -it keepcv setup
docker compose up -d
docker compose ps
```

Configure sign-in, choose Password and enter it twice. Other sections are
optional. Compose supplies the container listen address, password auth and public
origin. Open http://localhost:4319. AI configuration saved by setup takes effect
on the next start. A preexisting password can also be set with:

```sh
docker compose run --rm -it keepcv set-password
```

Use `docker compose logs` for startup errors and `docker compose restart` after
configuration changes. `docker compose down` keeps the named data volume.
Do not remove that volume unless you intend to erase its data.

The image runs as the `node` user (UID 1000). Named volumes work without host
permission changes. A bind mount must already be writable by that user. Do not
run two instances against the same PGlite directory. Stop the app before using
CLI commands that open the store.

## Local builds before publication

```sh
docker build -t keepcv:local .
node scripts/container-smoke.mjs keepcv:local
```

Set the Compose service image to `keepcv:local` and follow first launch, omitting
`pull`. The smoke script requires Node on the development host; running the app
does not. It creates and removes only its own temporary container and volume.

## Configuration and access

The default command is `serve`. Image environment defaults set `/data`, port
4319, listen address 0.0.0.0, password authentication and public origin
http://localhost:4319. Explicit flags override environment, then saved settings,
then launcher defaults. Compose publishes 127.0.0.1 on the host. To reach it
remotely,
change the published address deliberately, set `KEEPCV_ORIGIN` to the exact
browser-facing origin, and terminate HTTPS at a reverse proxy. The supplied
Compose file passes this variable into the launcher. Proxy sign-in
uses `KEEPCV_AUTH=proxy`, `KEEPCV_PROXY_HEADER`, `KEEPCV_PROXY_FROM` and optional
`KEEPCV_PROXY_USER`, without changing the command. Trust only the
actual proxy address. Never expose launch-token authentication off loopback.

Setup can save a protected OpenRouter key in `/data/config.json`. To keep it out
of that file, leave the key blank and add `OPENROUTER_API_KEY` to the service's
runtime environment through your deployment's secret management. It must reach
the container, not just the host shell. Do not put credentials in image build
arguments or committed Compose files. For advanced routes, mount a configuration
file read-only and set `KEEPCV_AGENT_CONFIG=/path/agent.json`.

Set supported variables in the Compose `environment` section or in a local
`.env` beside `compose.yaml` (copy `.env.example` to start). For example:

```dotenv
KEEPCV_PORT=5000
KEEPCV_ORIGIN=http://localhost:5000
KEEPCV_AUTH=password
```

The supplied file maps the same port on host and container and forwards optional
proxy/model settings. The named volume stays mounted at `/data`. Set
`KEEPCV_DATA_DIR` to `/data` or a subdirectory there to retain persistence and
non-root ownership. A different mount root needs a matching writable volume. Blank optional variables retain saved settings.
The healthcheck probes the configured listening port and works with password
or proxy authentication. Native `docker run` users can pass the same variables
with `-e`; when changing the port, also set the public origin and published port.

The complete [launcher variable table](../apps/cli/README.md#environment-variables)
lists all supported options. A local `.env` is used by Compose for interpolation;
the launcher itself does not implicitly load dotenv files. Keep credentials out
of committed files and use your deployment's secret management for runtime keys.

## Backup and upgrade

Download native backups from the app. The automatic mirror is also retained in
the data volume. Launcher configuration and password credentials are operational
files outside career-data exports; protect and back them up separately.

Pin the Compose image to `ghcr.io/keepcv/keepcv:<version>` or an image digest for
controlled upgrades. Take a backup, change the pin, then:

```sh
docker compose pull
docker compose up -d
```

Follow [Releasing](RELEASING.md#container-publication) for the maintainer setup and
first publication. No image is published by a local build or verify-mode run.
