# Bounded public web validation

This change is a release candidate, not a published package set. Do not publish
until provider-side exact query/path and public-network confinement have been
qualified or a transport enforcing those requirements is supplied. The hosted
server-tool API does not expose enough information to prove them locally.
The deployment contract and its limitations are in packages/agent/README.md.

## Repeatable checks

Use synthetic values and deterministic provider responses, with no live key:

```sh
pnpm check
pnpm --filter @keepcv/agent test
pnpm --filter @keepcv/editor exec vitest run src/features/agent/agent.test.tsx
pnpm release:check
```

For persistence and owner isolation, set DATABASE_URL to a throwaway real server
PostgreSQL and run the db suite. Its contract-agent file reports four tests:
two against PGlite and two against PostgreSQL. Those cover owner-scoped locks,
original attachments, immutable messages and native round-trip provenance.
With no server configured the same file reports only two tests.

Execution-counter mutation: removing the exactly-one requested/executed check
makes all three unsupported-execution tests fail because unverified sources are
accepted. Owner mutation: removing the conversation get owner predicate makes
the named isolation test fail on both drivers because the foreign owner's read
resolves instead of throwing NotFoundError. Restore each guard before running
normal checks. No mutation belongs in a commit.

Provider qualification must include unsupported endpoints, absent/zero/excess
execution counters, error bodies inside HTTP 200, domain escapes, redirects to
unapproved paths/domains, private DNS answers and rebinding. Confirm exact
engine-side query/URL arguments through a trustworthy service audit facility.
A model answer, requested engine name or successful public-only probe does not
establish those properties. Leave tools disabled when they cannot be verified.

## Installed consumer verification

Before publication, `pnpm release:check` installs packed candidate libraries,
launcher and editor outside this checkout. It checks public entry points,
authentication, writes, six exports, backup/restore and a built editor consumer.
It does not qualify live provider behavior.

Changesets currently calculates this compatible candidate set:

| Package | Candidate version |
|---|---|
| @keepcv/agent | 0.4.0 |
| @keepcv/api | 0.5.2 |
| @keepcv/editor | 0.8.0 |
| @keepcv/core | 0.5.1 |
| @keepcv/schema | 0.5.0 |
| @keepcv/db | 0.4.2 |
| @keepcv/cli | 0.2.2 |
| @keepcv/ats-lint | 0.1.7 |
| @keepcv/interop | 0.1.9 |
| @keepcv/render | 0.2.3 |
| @keepcv/templates | 0.2.3 |

After qualification, review and version preparation, follow docs/RELEASING.md:
merge reviewed versioning, synchronize release/0.2.2, run verify, then trusted
publication with the required npm environment approval. Verify registry versions
and integrity before installing the exact versions above with --save-exact from
outside the checkout. Candidate versions must not be presented as published.

Exercise the same reusable createOpenRouterModel/createAgent/createApi entry
points. Supply a public-only query and separately approve a public page. Check
external-tool usage independently of tokens; unknown counts retain the entire
reservation. Reload history, stop after a source is observed, export/import to
an empty store and confirm provenance and tool activity persist. Switch threads
and confirm approvals are cleared. Disable the assistant and verify edits,
original downloads, history and exports remain available. Do not copy a tool
loop into the consumer.

Native format remains v3 with optional message page approvals and source
provenance fields. Older readers can discard them. There is no migration, new
application event type or new edit grant. URL disclosure is separate consent.
The usage observer adds external-tool events; review exhaustive consumer event
switches when upgrading.
