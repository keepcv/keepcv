---
"@keepcv/agent": minor
"@keepcv/schema": minor
"@keepcv/editor": minor
"@keepcv/api": minor
"@keepcv/core": minor
"@keepcv/cli": patch
---

Add separately approved public page reads and explicit bounded external search
and fetch engines. Require reported tool execution, observe external calls
separately from tokens, and retain requested-page provenance on interrupted
conversations. Document provider-side confinement limits and deployment
limitations. Add a composer Web search toggle, capability availability and a
per-turn switch that removes the search tool when disabled. Ordinary editing
and export remain independent.
