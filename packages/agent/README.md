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
