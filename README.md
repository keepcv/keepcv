# KeepCV

[![CI](https://github.com/keepcv/keepcv/actions/workflows/test.yml/badge.svg)](https://github.com/keepcv/keepcv/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/@keepcv/cli)](https://www.npmjs.com/package/@keepcv/cli)
[![Latest release](https://img.shields.io/github/v/release/keepcv/keepcv)](https://github.com/keepcv/keepcv/releases/latest)
[![Monthly downloads](https://img.shields.io/npm/dm/@keepcv/cli)](https://www.npmjs.com/package/@keepcv/cli)
[![GitHub stars](https://img.shields.io/github/stars/keepcv/keepcv)](https://github.com/keepcv/keepcv/stargazers)
[![MIT license](https://img.shields.io/github/license/keepcv/keepcv)](LICENSE)

**Write it once. Never lose it.**

An open-source career data store that compiles into resumes.

You enter your career once - every role, project, point, skill, qualification -
and it stays there permanently. Resumes are *generated views* over that store:
select what is relevant, choose a template, produce a document. Nothing you
write is ever lost to make something fit.

> **Status: early development.** Published on npm as `@keepcv/cli`.

See the [latest release and notes](https://github.com/keepcv/keepcv/releases/latest).
The badges above show current versions and generated download/star statistics
without a workflow rewriting this file. Maintainers can follow the
[release procedure](docs/RELEASING.md).

## The idea

A resume file has to be short; career history needs room to grow. Keeping both
in one file makes every trim a loss of history. KeepCV stores the history and
lets each resume select what to show. Removing a resume leaves its source
content intact, and multiple resumes share the same store.

Tagging and prioritisation help you choose what fits each application.

## What makes it different

- **Points are first-class records, with multiple stored phrasings.** The same
  accomplishment gets reworded for every application. Without stored variants
  you rewrite from memory and the quality degrades a little each time. Write it
  three ways once, then pick per application.
- **Nothing is destroyed.** Phrasings are append-only revisions. Deletes are
  archives. A snapshot of what you sent in March still says what it said in
  March, even after you have edited the wording since.
- **Export is unconditional.** Every format, always free, never metered, never
  behind an account. Trust in a tool like this comes from being able to leave
  it.

## Running locally

Requires Node 24 or newer:

```sh
npx @keepcv/cli setup
npx @keepcv/cli serve
```

Setup walks through optional server, sign-in and OpenRouter chat configuration.
Skip any section to keep its settings, or skip setup entirely for local defaults.

Open the URL the launcher prints, including its `#token=...` fragment. The
launcher serves the web app and API together at `http://127.0.0.1:4319`.

The command keeps the store and its readable backup in `~/.keepcv`. Choose
another directory with `--data-dir`. Stop the launcher with `Ctrl+C`.

See the [launcher README](apps/cli/README.md) for its commands and sign-in modes.

Create your own layouts with the [visual template builder](docs/TEMPLATES.md).

## Run with Docker

Docker runs the app without Node or npm on your machine. After the first image
release, use the supplied [Compose file](compose.yaml):

```sh
docker compose pull
docker compose run --rm -it keepcv setup
docker compose up -d
```

In setup, configure sign-in and choose **Password**. Then open
<http://localhost:4319>. The named volume retains your store, settings and backup
when the container is recreated. Configure server, auth and model-route settings
through `KEEPCV_*` environment variables; the Compose command stays `serve`.
Use `docker compose down` to stop; keep the volume for the next launch.

See [Docker setup](docs/DOCKER.md) for local builds, version pins, AI credentials,
backups, remote access and image release preparation.

## Development

See [Contributing](CONTRIBUTING.md#getting-set-up) for setup, local development
and checks. The [documentation index](docs/README.md) links product guides,
package usage and architecture specifications.

## Security

KeepCV holds sensitive personal data. See [SECURITY.md](SECURITY.md) for the
threat model and how to report a vulnerability.

## Licence

MIT - see [LICENSE](LICENSE).

## Conversational assistance

The application opens on the assistant; the store overview remains at /overview.
Run `keepcv setup` to enable OpenRouter chat, or supply an advanced route file
with `keepcv serve --agent-config agent.json`.
See [agent configuration](packages/agent/README.md) for model routes, credentials,
hosted-search restrictions and supported attachments. Review changes before
accepting them, or grant bounded edits to the resource currently open. Original
files and conversation history are retained in native backups. Without model
configuration, ordinary editing and export remain available.
