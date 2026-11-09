# Documentation

Architecture specifications define current contracts. Guides explain tasks;
plans, research and release notes preserve historical context.

## Start here

| Task | Documentation |
|---|---|
| Run KeepCV | [Quick start](../README.md#running-locally); [launcher commands and sign-in](../apps/cli/README.md) |
| Choose or create a template | [Templates and resume design](TEMPLATES.md); [HTML examples](examples/html-templates/README.md) |
| Configure assistance | [Agent configuration](../packages/agent/README.md) |
| Develop and validate a change | [Contributing](../CONTRIBUTING.md); [agent and coding rules](../AGENTS.md) |
| Report a vulnerability | [Security](../SECURITY.md) |
| Prepare or publish a release | [Releasing](RELEASING.md) |

## Architecture

Read the relevant specification before changing a contract. Preserve numbered
headings when editing: repository guidance refers to their section numbers.

| Specification | Owns |
|---|---|
| [Data Model](architecture/data-model.md) | Persistence, ownership, ordering, revisions, manifests, invariants and indexes |
| [Template Model](architecture/template-model.md) | ResumeDocument, presenters, compilation, template types and binding language |
| [Application Structure](architecture/application-structure.md) | Package boundaries, state, cache writes, screens, recovery and preview |
| [API Contract](architecture/api-contract.md) | HTTP surface, errors, repository port, authentication and runtime authority |
| [Capabilities](architecture/capabilities.md) | Delivered behaviors, completion criteria, build dependencies and non-goals |

## Package usage

Each README owns its installation and consumer examples. Cross-package design
belongs in the architecture specifications.

| Package | Purpose |
|---|---|
| [schema](../packages/schema/README.md) | Shared Zod contracts |
| [core](../packages/core/README.md) | Pure domain functions and repository port |
| [db](../packages/db/README.md) | PostgreSQL and PGlite adapters |
| [api](../packages/api/README.md) | HTTP API and typed client |
| [editor](../packages/editor/README.md) | Embeddable browser editor |
| [templates](../packages/templates/README.md) | Template definitions and validation |
| [render](../packages/render/README.md) | Self-contained HTML rendering |
| [interop](../packages/interop/README.md) | External file readers and writers |
| [ats-lint](../packages/ats-lint/README.md) | Readability checks on rendered output |
| [agent](../packages/agent/README.md) | Conversational runtime and model configuration |
| [web app](../apps/web/README.md) | Local authentication entry and editor mounting |
| [launcher](../apps/cli/README.md) | CLI commands, local serving and backups |

## Historical material

- [Template workflow review](research/template-experience-review.md),
  [template-type research](research/template-types-and-html.md) and
  [HTML security review](research/html-template-security.md) preserve observations,
  sources, rejected candidates and investigation limits.
- [Template experience plan](plans/template-experience-overhaul.md) and
  [template-type plan](plans/template-types-and-html.md) preserve implementation
  scope, acceptance tasks and validation evidence.
- [Release notes](releases/) and package changelogs describe behavior at release
  time; they are not current specifications.

## Maintaining documentation

Keep each rule or procedure in its owning document and link to it elsewhere.
A short orientation or warning may repeat the rule; detailed arguments, command
lists and contracts should have one home. Keep package examples usable on their
own when published.

Before deleting a duplicate, compare both copies and retain every unique
constraint, example, exception and source in the owning document. Keep dated
research and release history when they carry evidence; label their status rather
than treating old proposals as current behavior. Update links in the same change
and verify section references after moving text.

Use plain verbs, short paragraphs and consistent product terms. Keep explicit
limits and failure behavior even when shortening explanations. Use tables for
reference and Mermaid for relationships, state transitions or sequences that
are harder to follow in prose. Give diagrams accessible titles and descriptions,
keep labels readable and retain the detailed contract in text. Validate local
links, ASCII source and diagram rendering before finishing.

This organization applies the [Diataxis compass](https://diataxis.fr/compass/)
to separate task instructions, reference and explanation without adding empty
document categories. Diagrams follow Mermaid's
[syntax](https://mermaid.js.org/intro/syntax-reference) and
[accessibility guidance](https://mermaid.js.org/config/accessibility).
