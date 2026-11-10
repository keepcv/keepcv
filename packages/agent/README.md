# @keepcv/agent

Conversational career-data actions for KeepCV. The runtime accepts a UnitOfWork
and an injected AgentModel; provider SDKs stay behind model adapters. The API
accepts the resulting AgentRuntime through createApi({ agent, ... }).

The built-in OpenRouter adapter supports bounded streaming tool use, ordered
qualified endpoints, public web tools and multimodal input. Custom models
implement AgentModel.generate using ModelRequest's read/describe/propose callbacks.
No adapter receives a database driver, owner lifecycle or permanent-erasure tool.

## Launcher configuration

Set OPENROUTER_API_KEY in the launcher's environment. Store a JSON configuration
with exact model IDs and approved provider slugs from the OpenRouter catalog:

```json
{
  "routes": [
    { "model": "your-qualified-model-id", "providers": ["approved-provider-slug"], "images": true, "pdf": true }
  ],
  "deadlineMs": 90000
}
```

Run `keepcv serve --agent-config agent.json`. No key or config is required for
ordinary editing and export. Credentials are resolved at startup and never sent
to the browser. Routes accept optional apiKeyEnv for separately configured keys.
Models and providers cannot be chosen through conversation requests.

Without external web configuration, an optional research route uses native
search. Enabling that route requires nativeSearchPolicyConfirmed: true after the operator verifies a locked native-only
OpenRouter workspace search policy and tests an unsupported route is refused.
A request's native engine alone is not a no-fallback guarantee. Research runs
only for the exact public query the user supplies in the research control.

Image and native-PDF support are separate route capabilities. Qualify the actual
model/endpoint and its data policy before enabling a flag. PDF parsing is pinned
to native; no independent OCR/search service or local URL downloader is enabled.
Text files are strictly decoded UTF-8. Original attachments stay in the owned
store and native backup; externally hosted file IDs are not their source of truth.

## Permissions and reliability

Suggestions are immutable pending proposals. Exact acceptance applies existing
repository operations and records a receipt in one transaction. Replay returns
the receipt. Bounded task grants permit ordinary updates to an explicitly named
resource; archive, restore, merges and grouped changes always require review.
Evidence, arbitrary HTTP, shell, filesystem, credentials and permanent erasure
have no model tool. A model's topic instructions are advisory; typed server
operations enforce what it can actually do.

Restart/import restores history, not active tasks or grants. Pending old proposals
need a fresh task before application. Stop prevents future operations; it does
not undo acknowledged changes. Stale proposals need renewed instructions.

Run pnpm check and pnpm release:check when changing the runtime or its contracts.
Deterministic tests use injected models; live endpoint qualification requires
operator credentials and synthetic files.

## Consumer authorization

`createAgent({ unitOfWork, model, disclosure, authorize, limits })` accepts an
optional async `authorize(context)` hook. It must return successfully to admit
work; throwing or rejecting refuses it. The context contains `ownerId`,
`conversationId`, optional trusted `scope`, an abort `signal`, and a phase:
`generate`, `read`, `propose` or `apply`. Proposal/application checks also include
the typed `operations` when known. It is not an authentication implementation.
The consumer resolves current authority from its own trusted state on every check.

The API's optional `agentScope(request, ownerId)` resolves the originating scope
once per turn, grant or decision request. It is not read from request JSON or
sent to the provider. Supply the same opaque scope for a session's related
requests. Without it existing owner/conversation behavior is retained.

```ts
import { createAgent, type AgentModel } from "@keepcv/agent";
import { createApi } from "@keepcv/api";

const agent = createAgent({
  unitOfWork,
  model: customModel satisfies AgentModel,
  disclosure: "Describe the configured model services here.",
  authorize: async ({ ownerId, scope, phase, operations, signal }) => {
    await checkCurrentAuthority({ ownerId, scope, phase, operations, signal });
  },
  limits: { maxAttachments: 2, maxTextCharacters: 8000 },
});
const api = createApi({
  unitOfWork, runAsOwner, authenticate, agent,
  agentScope: resolveTrustedScope,
});
// When the originating session is invalidated:
agent.revoke(ownerId, originatingScope);
```

The surrounding names are supplied by the embedding application. Model wrappers
can guard inference and unit-of-work wrappers can guard repository access, but
neither alone covers saved proposal admission, temporary grants and hosted calls.
The hook covers runtime history/attachment retrieval, each model resource read (including
a check before returning data), proposal admission and each operation in an
accepted or automatic group. Accepted changes are revalidated inside the locked
transaction and before its receipt is saved. The built-in adapter invokes
`ModelRequest.authorize` before each external inference step, native document call
and research call. API storage reads and turn preflight use request authentication and the caller's
unit of work; enforce additional access restrictions there. Custom models can call
this optional callback before additional external work and must honor `signal`; their existing required interface is unchanged.

`agent.cancel(ownerId, conversationId)` aborts active work and invalidates that
conversation's pending admissions and temporary grants. `agent.revoke(ownerId,
scope)` does the same for all work and grants originating in that scope, and
refuses future work in it for this runtime's lifetime. Use a new scope after
reauthorization. Revocation is owner-scoped even when imported IDs match.
`close()` is terminal: it stops active work, clears local authority and the sweep,
and marks capabilities unavailable. Discard that instance; it cannot be reopened.
Hook refusal also invalidates the current conversation's authority. No policy
exception details enter authored messages.

Signals are checked before and after authorization and at operation boundaries.
The runtime stops waiting even if a custom model ignores abort; late read/proposal
callbacks refuse work. Cancellation cannot retract data already returned to a
model or reverse an admitted external call. External adapters may still finish
and report usage. A cancellation arriving before the built-in unit of work's
pre-commit signal check rolls back the content group and receipt together. There
is a race between the final check and database COMMIT; a transaction already
admitted to commit may finish. Stopping never undoes committed edits. Stronger
ordering requires the consumer to serialize its authority change with its own
transaction boundary. Custom units of work must honor the signal and preserve
atomicity. Error/partial-history cleanup runs without active generation authority;
consumer wrappers must allow that retention without authorizing new career edits.
Optimistic concurrency tokens and locked, atomic receipts still protect stale
writes and duplicate acceptance.

Grants, proposal admissions, abort controllers and revoked-scope tombstones are
process-local and absent from exports. Restart/import preserves messages, original
files, proposal status and receipts, but never resumes authority or model work.
Pending proposals require a fresh authorized task to admit them again. Persisted
running status is historical; its bounded lease can delay a new task until expiry.
Stop releases no persisted lease by itself. It signals local work so normal
cleanup can finish, and cannot stop a controller held by another process. A new process must revalidate scopes through consumer state;
it cannot rely on another process's in-memory revocation tombstones. Multiple
processes need consumer routing/affinity for pending decisions and cancellation,
and current authorization checks in each process. On a rolling restart, in-flight
work must drain or be stopped; old-process proposals need fresh admission on the
new process. No cross-process cancellation transport is provided.

## Limits and usage

`limits` lowers the built-in runtime ceilings. `createApi({ agentLimits })` also
limits storage uploads and turn admission. Capabilities report the minimum of
these limits, with defaults for legacy custom runtimes. Shared `AgentLimits` and
`agentLimitsSchema` are exported by `@keepcv/schema`. The ceilings are 16 MiB per
file, 1 MiB per text file, 32 MiB of selected files per turn, five files and 32000
text characters. A zero attachment count disables file selection for generation,
not storage or historical downloads. Existing oversized files remain downloadable
and exportable; selecting them for a new turn is refused. Consumers must describe
any additional limits in their own presentation. Deployment rate limiting and
storage accounting stay outside this runtime.

`createOpenRouterModel(config, environment, onUsage)` optionally observes
`AgentUsageEvent` through exported types. A `call` event identifies a random
`callId`, optional `runId` (the turn's input ID), conversation/document/research
kind, configured model and provider allowlist, one-based attempt/step and outcome.
The provider list describes requested routing, not an assertion about which
endpoint served the request. Each started inference step reports once, including
retries/failover and unsuccessful/interrupted attempts where usage is available.
A final `run` event reports complete, failed or interrupted. Document and research
calls report separately from the conversation steps using their findings.

Usage fields are safe nonnegative provider token counts or `null`; `source` is
`provider` if at least one count was observed, otherwise `unknown`. Missing counts
are never inferred as zero, including SDK-normalized zero defaults. No estimates
are made. Events omit prompts, responses, files, arguments/results, credentials,
raw errors, costs and provider response metadata. Routing labels are truncated and
counts bounded to safe integers. The observer has no authority over execution:
throws/rejections are isolated and async observers are not awaited. Delivery is
process-local and best effort, with no durable queue or exactly-once accounting
guarantee across crashes. Consumers own durable recording, pricing and enforcement.
Custom `AgentModel` implementations remain compatible and own their usage reporting.


## Authority retention and Stop results

Each runtime holds at most 128 pending admissions, 128 grants and 128 distinct
owner/scope revocations. A pending review window lasts thirty minutes from the
originating turn's start. Expired grants and expired/aborted admissions are removed
at operation checks and by one unreferenced one-minute sweep, including while
idle. A successful decision deletes its admission after transaction acknowledgment;
applied/rejected receipts replay without local admission. Terminal proposals are
never readmitted, and observing terminal status decided elsewhere drops cached
admission too. Exhausted grants are removed after their final application
attempt. Committed history, attachments and receipts are never pruned by this work.

Admission/grant capacity refuses with 503 instead of evicting valid authority.
A proposal can remain saved and pending when its admission is refused. Expired
admissions refuse application with 409. To proceed, free capacity or wait for
expiry, then start a fresh authorized task, have it propose the change again and
review it. Cleanup itself never reauthorizes a pending proposal. Review expiry
observed inside application rolls back content and receipt together; the existing
race after the final check and before COMMIT is unchanged.

Revocations never expire in a usable instance. A 129th distinct revoked owner/scope
retires the entire runtime permanently, aborts its controllers, clears state and
makes capabilities unavailable. All scopes remain refused there (503), including
revocations whose records were reclaimed by terminal closure. Explicit close has
the same terminal lifecycle. The consumer may construct a replacement using its
current authorization state; no automatic rotation, grant restoration or resume
occurs. A replacement cannot rely on a retired instance's in-memory tombstones.

Built-in cancel returns true if it signalled a controller in this instance, false
if it had none; either outcome clears this instance's conversation admissions and
grants. The AgentRuntime port also permits legacy void cancellation, which gives
no positive local confirmation. cancel does not read or rewrite stored run state.
If the API sees no confirmed local controller and an unexpired bounded running
lease, Stop returns 409 and explains that the lease remains until expiry or the
executing process stops it. No other process's lease is cleared. Otherwise its
200 saved response means only that cancellation was requested. Locally active
work still needs to complete its interrupted-history cleanup; already admitted
external calls or transactions may finish. Expired historical leases allow a new
turn without restoring grants or proposal admissions. Stronger multi-process
coordination belongs to the consumer.


Direct deadlineMs configuration must be an integer between 1 and 180000 ms,
defaulting to 90000. Invalid configuration is refused at startup so a live task
cannot issue an out-of-bound lease that another runtime would ignore.


## Bounded public web tools

Optional `web` configuration on `AgentConfig` extends the research route. It
selects Parallel `turbo` search and OpenRouter fetch explicitly; no `auto`,
provider fallback or alternate engine is requested. Omit `web` to retain the
legacy native-only research configuration; that configuration still requires
its locked native-only workspace policy. Omit `research` to disable web tools.

```json
{
  "routes": [{ "model": "qualified/model", "providers": ["approved"] }],
  "research": { "model": "qualified/public-model", "providers": ["approved"] },
  "web": {
    "search": { "engine": "parallel", "mode": "turbo", "domains": ["example.com"] },
    "fetch": { "engine": "openrouter", "domains": ["example.com"] },
    "maxCalls": 2,
    "maxResults": 5,
    "maxCharacters": 1500,
    "maxContentTokens": 2000,
    "maxResponseBytes": 65536,
    "deadlineMs": 15000
  }
}
```

Keep credentials and this configuration server-side. Locked workspace settings
must agree with the explicitly selected engines. Neither schema nor core
contains credentials, provider choices or deployment policy.

The composer exposes a Web search switch, off initially and reset when changing
conversations. Enabling it reveals a public-query field. Capabilities report
`webSearchAvailable`; the switch is disabled when search is unavailable. Each
turn sends `webSearchEnabled`. An explicit false removes the research tool from
the model's tool list, even if a public query is present. Older callers that omit
the flag retain search approval through their explicit public query. Custom
models can advertise `webSearchAvailable` and should honor the turn flag.

The turn's `publicResearchQuery` is compared byte-for-byte with the research tool
argument. It is never derived from messages, career records, Evidence or files.
`publicPages: { urls: [...], disclosure: true }` separately consents to disclosing
up to four exact URLs. Search results authorize no fetch. A fetch tool argument
must match one approved URL exactly. Isolated hosted requests contain only the
approved query or URL and fixed instructions; private conversation context,
attachments and resource reads never enter that hosted request.

Local URL validation requires canonical HTTPS, exact configured hostnames, no
credentials, explicit ports, fragments, IP literals, localhost or local/internal
suffixes. Numeric, alternate IPv4, IPv6, percent-encoded authority and hostname
suffix tricks are refused. KeepCV never downloads the supplied URL. Inference
HTTP redirects are refused. DNS resolution, page redirects, DNS rebinding,
private-address blocking and internal server-tool arguments happen inside the
selected service: local validation cannot verify or constrain those operations.
The provider documentation promises domain filtering and truncation for these
engines; it does not specify their redirect or private-address security contract.
Internal query reformulation, redirects and resolved addresses are delegated to
the configured service. KeepCV checks the inputs it sends and does not claim
visibility into those service internals. These provider limitations do not gate
the Web search switch or availability of the configured tools.

The full external admission envelope is `maxCalls` hosted requests per turn,
with at most one requested server-tool execution per hosted request, zero
retries and no failover after a tool starts. A consumer can reserve the entire
configured envelope before calling `generate`; usage observation does not
perform admission or release a reservation. Search requests bound per-call and
total results and excerpt characters; fetch requests bound approximate context
tokens. Responses are read with a streaming byte ceiling, findings supplied to
the main model have a character ceiling, and each hosted request has a deadline.
Ceilings are four calls, ten results, 10000 characters, 10000 content tokens,
256 KiB and thirty seconds; defaults are in the example. Cancellation cannot
retract a provider request already admitted or its charges.

An `external-tool` usage event identifies `callId`, optional `runId`, actual
web tool, selected engine, admitted calls, observed requested/executed counts
(or null) and outcome, separately from model token usage. Exactly one requested
and one executed call in `usage.server_tool_use_details` are required before
findings are accepted. Unknown, zero and excess counts refuse findings. Missing
token counts remain unknown. These counters prove reported execution, not the
provider's internal destination, query or fetched content. Observers are best
effort and carry no private arguments/results. Consumer accounting should retain
the reservation when usage is missing or a process crashes.

Search sources come from returned citations. Fetch without annotations retains
the approved requested URL with `provenance: "requested-url"`; that is a record
of the request, not an invented citation or proof of the final redirect target.
Sources observed before a later interruption and actual tool names/purposes
remain in saved history and native recovery. No new application event type or
database migration is needed. The optional native-v3 fields are additive; older
readers may discard them, so upgrade all readers before transferring histories.

Fetched text remains untrusted model input. It cannot create tools, consent,
scopes or edit authority. Topic/factual instructions are advisory; exact typed
operations and current owner/session authorization still guard every read,
proposal and application. Normal editing, history, originals and export do not
require any web service or assistant capability.

Provider references: [search](https://openrouter.ai/docs/guides/features/server-tools/web-search)
and [fetch](https://openrouter.ai/docs/guides/features/server-tools/web-fetch).
