# Web access and composer validation

Web search is one current-turn permission for agent-chosen queries and page
reads. The agent adapter documents its server configuration and technical
execution envelope in packages/agent/README.md. Provider-side DNS, redirects and
query handling belong to the configured service.

## Repeatable checks

Use synthetic values and deterministic provider responses, with no live key:

```sh
pnpm check
pnpm --filter @keepcv/agent test
pnpm --filter @keepcv/editor exec vitest run src/features/agent/agent.test.tsx
pnpm release:check
```

Set DATABASE_URL to a throwaway real server PostgreSQL for the db suite. Its
contract-agent file reports four tests: two against PGlite and two against
PostgreSQL, covering owner-scoped locks, originals, immutable history and native
round-trip provenance. Without a server it reports only two.

Deterministic provider transports exercise a model-chosen query followed by
fetching a discovered link without approval fields or a domain list. Test web
access off, unavailable services, missing/invalid execution counts, optional
requested counts, per-turn exhaustion, cancellation and interrupted sources.
Search/fetch tools are absent when the turn opts out. No generated query or URL
can create edit authority or access private Evidence.

Execution-counter mutation: remove the executed-count guard and the unsupported
execution tests must fail because unverified findings become accepted. Owner
mutation: remove the conversation get owner predicate and its isolation test must
fail with a foreign-owner read resolving instead of NotFoundError. Restore all
guards before normal checks. Mutations never belong in commits.

## Installed consumers and UI

pnpm release:check installs packed libraries, launcher and editor outside the
checkout. It checks public entry points, builds an editor consumer, exercises web
search/page fetch, verifies authentication/writes/exports and round-trips native
backup/restore. After publication, install the exact compatible package versions
listed in the release notes with --save-exact and verify registry integrity.

With a configured server, enable web access from the composer's plus menu and
send an ordinary message. No query, domain or URL approval form is required.
Check that the menu closes and the active Web search chip appears. Remove the
chip and verify the next turn opts out. The menu supports arrows, Home/End,
Escape and outside dismissal, with focus returning to its trigger. Attachments
remain visible as removable chips. Model sharing is acknowledged once in the
connected editor session; Ask KeepCV does not ask again.

Conversation settings open in a separate dialog. Sharing recipients, consent and
current-resource task permission stay available there; file limits start
collapsed. Opening settings never expands or crowds the composer. Check desktop
and narrow screens, retained unsent input, file selection, keyboard submit,
Stop, grant/revoke and exact proposal review.

Observe actual external usage independently from model tokens. Reload/interrupt
history, export/import to an empty store and confirm sources/activity persist.
The chosen web preference carries across threads; historical messages never
control permission.
Disable the assistant and verify ordinary editing, originals, history and free
export remain available.

There is no migration, native version bump or new application event type. Legacy
query/page approval metadata stays readable as history; it is no longer required
by the composer or used to constrain agent-chosen web work. Usage observers
retain external-tool events. The consumer reuses the public runtime, never a
copied tool loop.
