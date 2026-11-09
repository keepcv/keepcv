# KeepCV

**Write it once. Never lose it.**

An open-source career data store that compiles into resumes.

You enter your career once - every role, project, point, skill, qualification -
and it stays there permanently. Resumes are *generated views* over that store:
select what is relevant, choose a template, produce a document. Nothing you
write is ever lost to make something fit.

> **Status: early development.** Published on npm as `@keepcv/cli`.

The [0.1.2 release notes](docs/releases/0.1.2.md) describe the first complete
release. Maintainers can follow the [release procedure](docs/RELEASING.md).

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
npx @keepcv/cli serve
```

Open the URL the launcher prints, including its `#token=...` fragment. The
launcher serves the web app and API together at `http://127.0.0.1:4319`.

The command keeps the store and its readable backup in `~/.keepcv`. Choose
another directory with `--data-dir`. Stop the launcher with `Ctrl+C`.

See the [launcher README](apps/cli/README.md) for its commands and sign-in modes.

Create your own layouts with the [visual template builder](docs/TEMPLATES.md).

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
Configure model access at startup with `keepcv serve --agent-config agent.json`.
See [agent configuration](packages/agent/README.md) for model routes, credentials,
hosted-search restrictions and supported attachments. Review changes before
accepting them, or grant bounded edits to the resource currently open. Original
files and conversation history are retained in native backups. Without model
configuration, ordinary editing and export remain available.
