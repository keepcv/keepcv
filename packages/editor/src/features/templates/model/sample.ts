import { RESUME_DOCUMENT_SCHEMA_VERSION, resumeDocumentSchema } from "@keepcv/schema";

export const SAMPLE_DOCUMENT = resumeDocumentSchema.parse({
  schemaVersion: RESUME_DOCUMENT_SCHEMA_VERSION,
  meta: { generatedAt: "2026-01-01T00:00:00.000Z", resumeName: "Sample resume", locale: "en-GB" },
  header: {
    fullName: "Jordan Taylor",
    headline: "Software engineer",
    location: "Bristol, UK",
    summary: [
      {
        t: "text",
        v: "Software engineer building reliable products and thoughtful developer tools. Experienced in taking services from early prototypes to production.",
      },
    ],
    contacts: [
      { key: "c0", kind: "email", value: "jordan@example.com", href: "mailto:jordan@example.com" },
      {
        key: "c1",
        kind: "website",
        value: "jordan.example.com",
        href: "https://jordan.example.com",
      },
    ],
  },
  sections: [
    {
      key: "s0",
      kind: "experience",
      heading: "Experience",
      layout: "entries",
      entries: [
        {
          key: "s0e0",
          kind: "experience",
          title: "Senior software engineer",
          organisation: { name: "Northstar Studio" },
          location: "Bristol, UK",
          period: { start: "2023-03", isCurrent: true, display: "Mar 2023 - Present" },
          points: [
            {
              key: "s0e0p0",
              text: [
                {
                  t: "text",
                  v: "Led the delivery of a shared platform used by six product teams, reducing release time from hours to minutes.",
                },
              ],
              plainText:
                "Led the delivery of a shared platform used by six product teams, reducing release time from hours to minutes.",
              metrics: [],
              tags: [],
            },
            {
              key: "s0e0p1",
              text: [
                {
                  t: "text",
                  v: "Improved service reliability through better monitoring, clear ownership and smaller, safer releases.",
                },
              ],
              plainText:
                "Improved service reliability through better monitoring, clear ownership and smaller, safer releases.",
              metrics: [],
              tags: [],
            },
          ],
          tags: [],
          links: [],
          fields: [],
        },
        {
          key: "s0e1",
          kind: "experience",
          title: "Software engineer",
          organisation: { name: "Fieldwork Digital" },
          period: {
            start: "2020-07",
            end: "2023-02",
            isCurrent: false,
            display: "Jul 2020 - Feb 2023",
          },
          points: [
            {
              key: "s0e1p0",
              text: [
                {
                  t: "text",
                  v: "Built accessible customer tools with designers and researchers, supporting a successful launch in three markets.",
                },
              ],
              plainText:
                "Built accessible customer tools with designers and researchers, supporting a successful launch in three markets.",
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
      kind: "project",
      heading: "Projects",
      layout: "entries",
      entries: [
        {
          key: "s1e0",
          kind: "project",
          title: "Open trail",
          subtitle: "Community route planner",
          period: { start: "2024", isCurrent: false, display: "2024" },
          summary: [
            {
              t: "text",
              v: "Created an offline route planner with clear directions and keyboard-accessible maps.",
            },
          ],
          points: [],
          tags: [],
          links: [
            {
              key: "s1e0l0",
              kind: "website",
              label: "Project website",
              url: "https://trail.example.com",
            },
          ],
          fields: [],
        },
      ],
    },
    {
      key: "s2",
      kind: "education",
      heading: "Education",
      layout: "entries",
      entries: [
        {
          key: "s2e0",
          kind: "education",
          title: "BSc Computer Science",
          organisation: { name: "Westbridge University" },
          period: { start: "2016", end: "2020", isCurrent: false, display: "2016 - 2020" },
          points: [],
          tags: [],
          links: [],
          fields: [],
        },
      ],
    },
    {
      key: "s3",
      kind: "skill",
      heading: "Skills",
      layout: "inline",
      entries: [
        {
          key: "s3e0",
          kind: "skill",
          title: "TypeScript, React, PostgreSQL, API design, accessibility, service reliability",
          points: [],
          tags: [],
          links: [],
          fields: [],
        },
      ],
    },
  ],
});
