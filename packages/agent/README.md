# @keepcv/agent

Conversational career-data actions for KeepCV. The runtime accepts a UnitOfWork
and an injected AgentModel; provider SDKs stay behind model adapters. The API
accepts the resulting AgentRuntime through createApi({ agent, ... }).

The built-in OpenRouter adapter supports bounded streaming tool use, ordered
qualified endpoints, native hosted research and multimodal input. Custom models
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

An optional research route has the same shape. Enabling it also requires
nativeSearchPolicyConfirmed: true after the operator verifies a locked native-only
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
`close()` stops active work and clears admissions/grants; discard that instance.
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
running status is historical; its bounded lease can delay a new task until expiry
(or explicit Stop). A new process must revalidate scopes through consumer state;
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
