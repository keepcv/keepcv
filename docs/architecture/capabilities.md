# Capabilities and Delivery

> Replaces the v0/v1/v2 phase model. Features are delivered
> complete, one sub-feature at a time.

---

## 1. Definition of Complete

A sub-feature is **not started** or **complete**. There is no partial state in
`main`.

- [ ] Schema and migration merged, expand/contract compliant
- [ ] API routes with Zod validation and `problem+json` errors
- [ ] Repository methods implemented and covered by the contract suite
- [ ] UI covers create, read, update, archive and restore — no dead ends
- [ ] Validation, error, loading and empty states all designed and built
- [ ] **Survives the export/import round-trip property test**
- [ ] Unit + integration tests; at least one end-to-end path
- [ ] Accessibility pass: keyboard navigation and screen-reader labels
- [ ] Docs updated; an architecture decision recorded if one was made
- [ ] Zero TODOs, zero feature flags left enabled, zero commented-out code

Every issue additionally declares:

1. **Which felt pain does this trace to?** — no answer, no
   feature.
2. **Declared non-goals.** Where scope pressure gets absorbed: a good idea
   arriving mid-slice becomes a new issue, not a bigger current one.

---

## 2. Build order

```
F0 Foundation
   └▶ F1 Profile
      └▶ F2 Career Record Store
         └▶ F4 Points & Phrasings              ← the differentiator
            └▶ F3 Tagging & Search
               └▶ F5 Composition
                  └▶ F6 Render & Templates
                     └▶ F7 Export
                        └▶ F8 Versions & Snapshots
                           ├▶ F9  Import
                           ├▶ F10 ATS Linter
                           ├▶ F11 Accounts & Sync
                           ├▶ F12 Role Profiles
                           └▶ F13 Portfolio Site
```

F2 before F4 because points attach to records that must already exist.
F3 after F4 because tagging should be built once, across both, rather than
twice. F10 before any future template builder.

---

## 3. Capabilities

### F0 · Foundation

| # | Sub-feature |
|---|---|
| F0.1 | pnpm + Turborepo workspace, catalogs, Changesets, package skeletons |
| F0.2 | Biome + typescript-eslint + strict tsconfig + CI pipeline |
| F0.3 | `@keepcv/schema`: Zod base, schema versioning, JSON Schema emit |
| F0.4 | `@keepcv/db`: Drizzle setup, PGlite + Postgres drivers, migration runner |
| F0.5 | `@keepcv/core`: repository port, sort-key arithmetic, canonicalisation, hashing |
| F0.6 | `@keepcv/api`: Hono app, validation, `problem+json`, typed client, OpenAPI |
| F0.7 | `apps/web`: Vite, Router, Query, shadcn/Base UI, theming, error boundaries |
| F0.8 | `apps/local`: `npx keepcv` launcher, PGlite wiring, security controls |
| F0.9 | **Native export/import + round-trip property test** |
| F0.10 | JSON mirror durability + `keepcv restore` |
| F0.11 | Test harness: Vitest, Testcontainers parity, Playwright, axe |

> F0.9 is in the foundation deliberately. Once the round-trip test exists,
> every later slice inherits a test proving it did not break portability.

**Non-goals:** no auth, no hosted deployment, no telemetry.

### F1 · Profile
F1.1 identity fields · F1.2 contact channels with default visibility ·
F1.3 professional summary with phrasing variants · F1.4 private vs exportable
flags

### F2 · Career Record Store
F2.1 organisations · F2.2 experience, incl. multiple roles per organisation ·
F2.3 education · F2.4 projects and links · F2.5 skills · F2.6 certifications
with expiry · F2.7 publications, awards, languages, volunteering, speaking ·
F2.8 custom sections · F2.9 uniform links and fields on every record kind ·
F2.10 cross-cutting: partial dates, archive and restore, drag-and-drop
ordering, incompleteness nudges · F2.11 a presenter per record kind

### F3 · Tagging & Search
F3.1 tag vocabulary with rename and merge · F3.2 assignment across records and
points · F3.3 global full-text search · F3.4 type-ahead trigram search ·
F3.5 filters persisted in the URL · F3.6 saved filters

### F4 · Points & Phrasings ← the heart
F4.1 point records, primary and secondary parents · F4.2 phrasing sets,
variants, immutable revisions · **F4.3 the authoring interface**
· F4.4 constrained inline markup editor · F4.5 structured metrics ·
F4.6 private evidence · F4.7 confidence levels · F4.8 revision history, compare,
restore · F4.9 usage view: "where is this used?"

### F5 · Composition
F5.1 resume entity and target context · F5.2 include/exclude toggles ·
F5.3 phrasing selection per point · F5.4 section and entry reordering ·
F5.5 section headings and visibility · F5.6 per-resume contact visibility ·
F5.7 derive a resume from an existing one

### F6 · Render & Templates
F6.1 `ResumeDocument` compiler and the shared template fixture
(`template-model.md`) · F6.2 template contract and config schemas ·
F6.3 ATS-strict single-column template · F6.4 Paged.js live preview in an
isolated iframe · F6.5 typography and spacing configuration · F6.6 additional
templates · F6.7 length budgeting with overflow warnings and drop suggestions

### F7 · Export
F7.1 PDF · F7.2 HTML · F7.3 JSON Resume adapter with explicit lossiness
warnings · F7.4 DOCX · F7.5 LaTeX / Typst · F7.6 full-store backup and restore

### F8 · Versions & Snapshots
F8.1 version capture on export and save · F8.2 timeline UI · F8.3 diff between
any two versions · F8.4 restore as a forward operation · F8.5 starred snapshots
with labels and target context · F8.6 usage index maintenance

### F9 · Import
F9.1 native import · F9.2 JSON Resume import · F9.3 PDF parsing ·
F9.4 DOCX parsing · F9.5 RenderCV and Reactive Resume adapters ·
**F9.6 reconciliation UI** — every import is reviewed before it is applied

### F10 · ATS Linter
F10.1 rule engine and report contract · F10.2 column reading-order integrity ·
F10.3 non-standard section headings · F10.4 text rendered as images ·
F10.5 unparseable dates · F10.6 contact-detail extractability ·
F10.7 compliance tiers derived from lint results, never asserted (G8)

### F11 · Accounts & Sync
F11.1 Better Auth integration · F11.2 server storage adapter ·
F11.3 local ↔ hosted migration · F11.4 account deletion with mandatory export
offer · F11.5 server-side entitlements, in the private repo only (G13)

### F12 · Role Profiles
F12.1 tag-rule definition · F12.2 apply a profile to pre-select a record set ·
F12.3 profile management

### F13 · Portfolio Site
A second renderer over `ResumeDocument`, not a second product.

---

## 4. Standing non-goals

Restated because they will be requested: no job application tracking, no job
boards, no interview preparation, no recruiter-facing products, no AI writing
features, no LinkedIn scraping, no mobile apps, and no claims of certification
against named commercial ATS products.
