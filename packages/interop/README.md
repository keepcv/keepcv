# @keepcv/interop

Adapters between KeepCV and the resume formats other tools speak. Every one of
them loses something, and saying what is the job.

```ts
import { lossOf, toJsonResume } from "@keepcv/interop";

const resume = toJsonResume(document);  // JSON Resume v1.0.0
const losses = lossOf(document);        // [{ what, count, detail }]
```

Reading goes the other way, into an `Intake` - what a file said, before anything
decides what to do about it:

```ts
import { fromJsonResume, fromReactiveResume, fromRenderCv } from "@keepcv/interop";
import { parseRenderCv, pdfLines, docxLines } from "@keepcv/interop/files";

fromReactiveResume(JSON.parse(body));
fromRenderCv(parseRenderCv(body));
```

`@keepcv/interop/files` is a subpath because the parsers live there: a caller
that only speaks JSON never loads a PDF engine or a YAML parser.

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

## What each reader has to work out

| Format | Given | Worked out |
|---|---|---|
| JSON Resume | every field, named | nothing |
| Reactive Resume | every field, named; text as HTML | which paragraphs are the summary and which lines are points |
| RenderCV | every field, named; the entry type from which keys are set | the record kind, from the heading, for the entry types that name nothing |
| PDF, DOCX | text and how it looked | all of it |

Only PDF and DOCX are `inferred`. The other three declare what each thing is, so
the review screen does not warn about them - but a RenderCV heading that decides
a kind is still a guess, and the kind is on the row before it is approved.

Two things Reactive Resume does that the store is unusually well shaped for: an
item marked `hidden` is content the user trimmed off a resume, which is what a
store behind a resume is for, so it comes in; and several roles at one company
become several records under one organisation.

A skill level is translated between two named four-rung scales - `Beginner`,
`Intermediate`, `Advanced`, `Expert` against `familiar`, `working`, `proficient`,
`expert`. A word on neither scale, like JSON Resume's `Master`, is reported in
`notes` rather than moved to the nearest rung.

## Not built

Writing RenderCV or Reactive Resume. Reading them is; a format nobody asked to
export to is loss with nothing on the other side of it.
