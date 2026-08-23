import type { ResumeDocument } from "@keepcv/schema";
import { RESUME_DOCUMENT_SCHEMA_VERSION } from "@keepcv/schema";

// Passing this is the definition of "is a template", so it carries every slot,
// every field kind, all three inline marks, all three layouts, a section with
// nothing under it, an entry with no points, a point with no metrics, an entry
// no group claims, and a kind no presenter emits.
export const FIXTURE_DOCUMENT: ResumeDocument = {
  schemaVersion: RESUME_DOCUMENT_SCHEMA_VERSION,
  meta: {
    generatedAt: "2026-03-14T09:00:00.000Z",
    resumeName: "Every slot, once",
    locale: "en-GB",
  },
  header: {
    fullName: "Ada Lovelace",
    headline: "Backend engineer, distributed systems",
    pronouns: "she/her",
    location: "London, UK",
    summary: [
      { t: "text", v: "Ships " },
      { t: "b", c: [{ t: "text", v: "measurable" }] },
      { t: "text", v: " work on " },
      { t: "i", c: [{ t: "text", v: "large" }] },
      { t: "text", v: " ingest systems." },
    ],
    contacts: [
      { key: "c0", kind: "email", value: "ada@example.org", href: "mailto:ada@example.org" },
      { key: "c1", kind: "phone", value: "+44 20 7946 0000", href: "tel:+442079460000" },
      {
        key: "c2",
        kind: "github",
        label: "GitHub",
        value: "github.com/ada",
        href: "https://github.com/ada",
      },
      { key: "c3", kind: "location", value: "London, UK" },
      { key: "c4", kind: "other", label: "Availability", value: "Notice period 1 month" },
    ],
  },
  sections: [
    {
      key: "s0",
      kind: "experience",
      heading: "Experience",
      layout: "grouped",
      groups: [
        {
          key: "s0g0",
          title: "Acme",
          subtitle: "London, UK",
          period: { start: "2021-02", isCurrent: true, display: "Feb 2021 - Present" },
          entryKeys: ["s0e0", "s0e1"],
        },
      ],
      entries: [
        {
          key: "s0e0",
          kind: "experience",
          title: "Staff engineer",
          subtitle: "Ingest platform",
          organisation: { name: "Acme", url: "https://acme.example", location: "London, UK" },
          period: { start: "2023-04", isCurrent: true, display: "Apr 2023 - Present" },
          location: "London, UK",
          mode: "Hybrid",
          summary: [{ t: "text", v: "Owns the pipeline the whole product reads from." }],
          points: [
            {
              key: "s0e0p0",
              text: [
                { t: "text", v: "Cut p95 latency on the " },
                { t: "b", c: [{ t: "text", v: "ingest path" }] },
                { t: "text", v: ", written up " },
                {
                  t: "a",
                  href: "https://acme.example/blog/ingest",
                  c: [{ t: "text", v: "on the blog" }],
                },
              ],
              plainText: "Cut p95 latency on the ingest path, written up on the blog",
              metrics: [
                {
                  key: "s0e0p0m0",
                  label: "p95 latency",
                  display: "800ms -> 120ms",
                  value: 120,
                  unit: "ms",
                  baseline: 800,
                  direction: "decrease",
                },
              ],
              tags: ["performance"],
            },
            {
              key: "s0e0p1",
              text: [{ t: "text", v: "Mentored four engineers through their first on-call." }],
              plainText: "Mentored four engineers through their first on-call.",
              metrics: [],
              tags: [],
            },
          ],
          tags: ["backend", "performance"],
          links: [
            {
              key: "s0e0l0",
              kind: "repo",
              label: "acme/ingest",
              url: "https://github.com/acme/ingest",
            },
          ],
          fields: [],
        },
        {
          key: "s0e1",
          kind: "experience",
          title: "Senior engineer",
          organisation: { name: "Acme" },
          period: {
            start: "2021-02",
            end: "2023-03",
            isCurrent: false,
            display: "Feb 2021 - Mar 2023",
          },
          mode: "Remote",
          points: [],
          tags: [],
          links: [],
          fields: [],
        },
        {
          key: "s0e2",
          kind: "experience",
          title: "Independent consultant",
          period: {
            start: "2019",
            end: "2021-01",
            isCurrent: false,
            display: "2019 - Jan 2021",
          },
          points: [
            {
              key: "s0e2p0",
              text: [{ t: "text", v: "Rebuilt a billing reconciliation job." }],
              plainText: "Rebuilt a billing reconciliation job.",
              metrics: [],
              tags: [],
            },
          ],
          tags: [],
          links: [],
          fields: [],
        },
      ],
    },
    {
      key: "s1",
      kind: "skill",
      heading: "Skills",
      layout: "inline",
      entries: [
        {
          key: "s1e0",
          kind: "skill",
          title: "TypeScript",
          points: [],
          tags: [],
          links: [],
          fields: [],
        },
        {
          key: "s1e1",
          kind: "skill",
          title: "PostgreSQL",
          points: [],
          tags: [],
          links: [],
          fields: [],
        },
        { key: "s1e2", kind: "skill", title: "Rust", points: [], tags: [], links: [], fields: [] },
      ],
    },
    {
      key: "s2",
      kind: "certification",
      heading: "Certifications",
      layout: "entries",
      entries: [
        {
          key: "s2e0",
          kind: "certification",
          title: "Solutions Architect",
          organisation: { name: "AWS" },
          period: { start: "2024-06", isCurrent: false, display: "Jun 2024" },
          points: [],
          tags: [],
          links: [
            {
              key: "s2e0l0",
              kind: "credential",
              label: "Verify",
              url: "https://verify.example/AWS-1234",
            },
          ],
          fields: [
            { key: "credentialId", label: "Credential ID", value: "AWS-1234", kind: "text" },
            { key: "expiresOn", label: "Expires", value: "Jun 2027", kind: "date" },
            { key: "score", label: "Score", value: "912", kind: "number" },
            { key: "handbook", label: "Handbook", value: "https://aws.example/sa", kind: "url" },
          ],
        },
        {
          key: "s2e1",
          kind: "certification",
          title: "Certified Kubernetes Administrator",
          organisation: { name: "CNCF" },
          points: [],
          tags: [],
          links: [],
          // The same key as the entry above it: a field key names a column, so
          // it repeats across entries and cannot be what `data-key` carries.
          fields: [{ key: "credentialId", label: "Credential ID", value: "CKA-99", kind: "text" }],
        },
      ],
    },
    {
      key: "s3",
      kind: "custom",
      heading: "Selected writing",
      layout: "entries",
      entries: [
        {
          key: "s3e0",
          kind: "invented_by_a_later_release",
          title: "Why <script> tags are not a resume format",
          subtitle: "Essay",
          period: { start: "2025-11-02", isCurrent: false, display: "2 Nov 2025" },
          points: [
            {
              key: "s3e0p0",
              text: [{ t: "text", v: "Read 40k times in a week." }],
              plainText: "Read 40k times in a week.",
              metrics: [],
              tags: [],
            },
          ],
          tags: ["writing"],
          links: [],
          fields: [{ key: "wordCount", label: "Words", value: "2400", kind: "number" }],
        },
      ],
    },
    {
      key: "s4",
      kind: "award",
      heading: "Awards",
      layout: "entries",
      entries: [],
    },
  ],
};
