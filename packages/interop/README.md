# @keepcv/interop

Adapters between KeepCV and the resume formats other tools speak. Every one of
them loses something, and saying what is the job.

```ts
import { lossOf, toJsonResume } from "@keepcv/interop";

const resume = toJsonResume(document);  // JSON Resume v1.0.0
const losses = lossOf(document);        // [{ what, count, detail }]
```

## Why it reads a document and not the store

JSON Resume describes a **resume**. A KeepCV store is a career history, most of
which is deliberately not on any one resume. So the adapter takes a
`ResumeDocument` - the thing a template binds to - which is also why it is a
function rather than a `?format=` on `/v1/export`: the caller is holding the
document already. The native whole-store export is a repository method and lives
elsewhere, because that one really is the server's to answer.

## What maps

| KeepCV | JSON Resume |
|---|---|
| experience | `work` |
| volunteering | `volunteer` |
| education | `education` (title becomes `studyType`, subtitle `area`) |
| award | `awards` |
| certification | `certificates` |
| publication | `publications` |
| skill | `skills`, with tags as `keywords` |
| language | `languages` |
| project | `projects`, with tags as `keywords` |
| points on an entry | `highlights` |
| email, phone, website, location | `basics` |
| linkedin, github, scholar, orcid | `basics.profiles` |

Dates travel as the partial dates the record holds - `2021`, `2021-02`,
`2021-02-11` are all ISO 8601, which is what the format asks for. `period.display`
is ours and never leaves: "Feb 2021 - Present" is not a date anything can parse.

A list this resume has nothing for is left out rather than written empty.

## What does not

`lossOf` answers that, counted against the resume in hand rather than as a
standing list of caveats - three metrics, two sections with nowhere to go, one
renamed heading. Nothing with a count of zero appears in it, which is what makes
it worth reading. The app shows it before the download, not after.

Anything the format has no list for is dropped rather than forced into one that
means something else: a talk is not a project, and a custom section is not
anything. Metrics have nowhere to sit, because a highlight is one string.
Everything travels as plain text, so emphasis and inline links go.

Evidence is not here to lose: `ResumeDocument` has no field it could travel in.

## Not built

Import, and the reconciliation interface every import goes through. RenderCV and
Reactive Resume. PDF and DOCX parsing.
