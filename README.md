# KeepCV

**Write it once. Never lose it.**

An open-source career data store that compiles into resumes.

You enter your career once - every role, project, point, skill, qualification -
and it stays there permanently. Resumes are *generated views* over that store:
select what is relevant, choose a template, produce a document. Nothing you
write is ever lost to make something fit.

> **Status: early development.** The app runs locally from a checkout. There is
> no release yet.

The [0.1.1 release notes](docs/releases/0.1.1.md) describe the prepared first
release. Maintainers can follow the [release procedure](docs/RELEASING.md).

## The idea

Most people keep their career history *inside* their resume file. That makes
the resume simultaneously the document and the database, and the two roles
conflict: a database should accumulate, a document must be short. The document
always wins, so content gets destroyed.

Every trim to fit one page is a permanent, unrecoverable delete.

KeepCV separates them. The store holds everything, forever. A resume is a
selection over the store plus a template. Deleting a resume loses nothing, and
ten resumes share one copy of the truth.

The hard part was never *fitting* - it is *choosing*, because the choice is
destructive. So this is a tagging and prioritisation tool, not a typography
tool.

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

Requires Node 24+ and pnpm via corepack. From the repository root:

```sh
corepack enable
pnpm install
pnpm build
node apps/cli/dist/index.js serve --data-dir ./.keepcv-scratch
```

Open the URL the launcher prints, including its `#token=...` fragment. The
launcher serves the web app and API together at `http://127.0.0.1:4319`.

The command keeps the store and its readable backup in `.keepcv-scratch`, an
ignored directory inside the checkout. Reuse it to keep your data between runs,
or choose another directory with `--data-dir`. Stop the launcher with `Ctrl+C`.

See the [launcher README](apps/cli/README.md) for its commands and sign-in modes.

## Development

Run the repository checks:

```sh
pnpm check
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for how the project is organised and
what "complete" means here.

## Security

KeepCV holds sensitive personal data. See [SECURITY.md](SECURITY.md) for the
threat model and how to report a vulnerability.

## Licence

MIT - see [LICENSE](LICENSE).
