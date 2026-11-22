import { newUuid } from "../../packages/core/dist/index.js";

export async function seed(call) {
  const id = newUuid;
  const profile = await call("/v1/profile");
  const summary = await call("/v1/phrasing-sets", "POST", {
    id: id(),
    purpose: "profile_summary",
    phrasing: {
      id: id(),
      variant: "standard",
      label: null,
      sortKey: "a0",
      body: [
        {
          t: "text",
          v: "Product engineer building reliable tools that make complex work feel simple. Six years across platform engineering, accessibility and developer experience.",
        },
      ],
    },
  });
  await call("/v1/profile", "PATCH", {
    expectedUpdatedAt: profile.updatedAt,
    patch: {
      fullName: "Alex Morgan",
      headline: "Senior Product Engineer",
      location: "Bristol, UK",
      pronouns: "they/them",
      summarySetId: summary.id,
    },
  });
  for (const [kind, value] of [
    ["email", "alex@example.com"],
    ["website", "https://example.com/alex"],
    ["phone", "+44 7700 900123"],
  ]) {
    await call("/v1/contact-channels", "POST", {
      id: id(),
      kind,
      label: null,
      value,
      isDefaultVisible: true,
      sortKey: `a${kind === "email" ? 0 : kind === "website" ? 1 : 2}`,
    });
  }
  const organisations = [];
  for (const name of ["Northstar Labs", "Fieldwork Studio", "Westbridge University"]) {
    organisations.push(
      await call("/v1/organisations", "POST", {
        id: id(),
        name,
        kind: name.includes("University") ? "institution" : "company",
        website: "https://example.com",
        industry: null,
        location: "Bristol, UK",
      }),
    );
  }
  const section = await call("/v1/custom-sections", "POST", {
    id: id(),
    heading: "Community",
    sortKey: "a0",
  });
  const tags = [];
  for (const label of ["Platform", "Leadership", "Accessibility", "Product"]) {
    tags.push(await call("/v1/tags", "POST", { id: id(), label, category: null }));
  }
  const definitions = [
    [
      "experience",
      "Senior Product Engineer",
      "Platform & developer experience",
      0,
      "2023-04",
      null,
      { employmentType: "Full-time", mode: "hybrid" },
    ],
    [
      "experience",
      "Software Engineer",
      "Product engineering",
      1,
      "2020-06",
      "2023-03",
      { employmentType: "Full-time", mode: "onsite" },
    ],
    [
      "education",
      "BSc Computer Science",
      "First-class honours",
      2,
      "2016",
      "2020",
      {
        grade: "First",
        gradeScale: null,
        thesisTitle: "Accessible interfaces for complex systems",
        honours: "First-class honours",
      },
    ],
    [
      "project",
      "Compass Design System",
      "Accessible components for 12 product teams",
      0,
      "2024",
      null,
      {},
    ],
    [
      "skill",
      "TypeScript, React & Node.js",
      "Product engineering",
      null,
      null,
      null,
      { category: "Engineering", proficiency: "expert" },
    ],
    [
      "skill",
      "PostgreSQL & system design",
      "Reliable platforms",
      null,
      null,
      null,
      { category: "Engineering", proficiency: "proficient" },
    ],
    [
      "certification",
      "Cloud Architecture",
      "Professional certificate",
      null,
      "2025-02",
      null,
      { credentialId: "DEMO-2025-0142", expiresOn: "2028-02" },
    ],
    [
      "publication",
      "Designing for the next maintainer",
      "Engineering journal",
      null,
      "2025-06",
      null,
      { doi: null },
    ],
    ["award", "Engineering Impact Award", "Northstar Labs", 0, "2025", null, {}],
    ["language", "English", null, null, null, null, { proficiency: "Native" }],
    ["volunteering", "Community Coding Mentor", "Weekend code club", null, "2022", null, {}],
    ["speaking", "Accessible by default", "Product Engineering Summit", null, "2026-05", null, {}],
    [
      "custom_entry",
      "Open source maintainer",
      "Tools for a more open web",
      null,
      "2021",
      null,
      { customSectionId: section.id },
    ],
  ];
  const records = [];
  for (const [
    i,
    [kind, title, subtitle, org, startedOn, endedOn, extras],
  ] of definitions.entries()) {
    records.push(
      await call("/v1/records", "POST", {
        id: id(),
        kind,
        title,
        subtitle,
        organisationId: org === null ? null : organisations[org].id,
        startedOn,
        endedOn,
        isCurrent: startedOn !== null && endedOn === null,
        location: kind === "experience" ? "Bristol, UK" : null,
        sortKey: `a${i < 10 ? i : String.fromCharCode(65 + i - 10)}`,
        summarySetId: null,
        ...extras,
      }),
    );
  }
  const texts = [
    "Reduced deployment time by 42% by rebuilding the release pipeline used by 12 product teams.",
    "Led a team of six engineers to ship a shared platform serving 80,000 weekly users.",
    "Raised accessibility coverage to 98% across the core product experience.",
    "Cut support escalations by 31% with clearer diagnostics and resilient background jobs.",
    "Built a reusable component library adopted by 12 teams and 4 customer-facing products.",
    "Mentored eight early-career engineers through their first production releases.",
    "Published migration guides that reduced new-team onboarding from ten days to four.",
  ];
  const points = [];
  for (const [i, text] of texts.entries()) {
    points.push(
      await call("/v1/points", "POST", {
        id: id(),
        recordId: records[i < 3 ? 0 : i < 4 ? 1 : i < 5 ? 3 : 10].id,
        phrasingSetId: id(),
        confidence: "verified",
        occurredOn: "2025",
        sortKey: `a${i}`,
        phrasing: {
          id: id(),
          variant: "standard",
          label: null,
          sortKey: "a0",
          body: [{ t: "text", v: text }],
        },
      }),
    );
  }
  const store = await call("/v1/store");
  const firstPhrasing = store.phrasings.find((p) => p.phrasingSetId === points[0].phrasingSetId);
  await call("/v1/phrasings", "POST", {
    id: id(),
    phrasingSetId: points[0].phrasingSetId,
    variant: "short",
    label: "Compact",
    sortKey: "a1",
    body: [{ t: "text", v: "Cut deployment time 42% across 12 product teams." }],
  });
  await call(`/v1/phrasings/${firstPhrasing.id}/revisions`, "POST", {
    body: [{ t: "text", v: texts[0].replace("rebuilding", "redesigning") }],
  });
  await call("/v1/metrics", "POST", {
    id: id(),
    pointId: points[0].id,
    label: "Deployment time",
    value: 42,
    unit: "%",
    baseline: null,
    direction: "decrease",
    period: "2025",
    sortKey: "a0",
  });
  await call("/v1/evidence", "POST", {
    id: id(),
    pointId: points[0].id,
    kind: "note",
    value: "Fictional demo evidence: release dashboard comparison, January to June 2025.",
    note: "Kept private. Never printed on a resume.",
  });
  await call("/v1/record-links", "POST", {
    id: id(),
    recordId: records[3].id,
    kind: "demo",
    label: "Project overview",
    url: "https://example.com/compass",
    sortKey: "a0",
  });
  await call("/v1/record-fields", "POST", {
    id: id(),
    recordId: records[3].id,
    key: "adoption",
    label: "Adoption",
    value: "12 product teams",
    valueKind: "text",
    sortKey: "a0",
  });
  for (const [i, record] of records.entries())
    await call(`/v1/records/${record.id}/tags/${tags[i % tags.length].id}`, "PUT");
  for (const [i, point] of points.entries())
    await call(`/v1/points/${point.id}/tags/${tags[i % tags.length].id}`, "PUT");
  const role = await call("/v1/role-profiles", "POST", {
    id: id(),
    name: "Platform leadership",
    sortKey: "a0",
  });
  for (const tag of tags.slice(0, 2))
    await call(`/v1/role-profiles/${role.id}/tags/${tag.id}`, "PUT");
  const resume = await call("/v1/resumes", "POST", {
    id: id(),
    name: "Platform Engineer",
    targetCompany: "Northstar Labs",
    targetRole: "Staff Platform Engineer",
    targetUrl: "https://example.com/careers",
    targetJdText:
      "Build reliable platform systems with TypeScript, React and PostgreSQL. Lead engineers, improve developer experience, accessibility and deployment automation. Mentor teams and own system design.",
    appliedOn: null,
    templateId: "single-column-v2",
    templateConfig: {},
    pageLimit: 1,
  });
  const placed = [];
  for (const [i, kind] of ["experience", "project", "education", "skill"].entries()) {
    const s = await call("/v1/resume-sections", "POST", {
      id: id(),
      resumeId: resume.id,
      kind,
      customSectionId: null,
      heading: null,
      layout: null,
      sortKey: `a${i}`,
      isVisible: true,
    });
    for (const [j, record] of records.filter((r) => r.kind === kind).entries()) {
      const entry = await call("/v1/resume-entries", "POST", {
        id: id(),
        resumeId: resume.id,
        resumeSectionId: s.id,
        recordId: record.id,
        sortKey: `a${j}`,
        isVisible: true,
      });
      placed.push(entry);
      for (const [k, point] of points.filter((p) => p.recordId === record.id).entries()) {
        const phrasing = store.phrasings.find((p) => p.phrasingSetId === point.phrasingSetId);
        await call("/v1/resume-entry-points", "POST", {
          id: id(),
          resumeId: resume.id,
          resumeEntryId: entry.id,
          pointId: point.id,
          phrasingId: phrasing.id,
          sortKey: `a${k}`,
          isVisible: true,
        });
      }
    }
  }
  await call("/v1/resume-versions", "POST", {
    id: id(),
    resumeId: resume.id,
    trigger: "manual_save",
  });
  const current = await call("/v1/store");
  const selected = current.resumeEntryPoints[0];
  await call(`/v1/resume-entry-points/${selected.id}`, "PATCH", {
    expectedUpdatedAt: selected.updatedAt,
    patch: { isVisible: false },
  });
  await call("/v1/resume-versions", "POST", {
    id: id(),
    resumeId: resume.id,
    trigger: "manual_save",
  });
  const hidden = await call(`/v1/resume-entry-points/${selected.id}`);
  await call(`/v1/resume-entry-points/${selected.id}`, "PATCH", {
    expectedUpdatedAt: hidden.updatedAt,
    patch: { isVisible: true },
  });
  return {
    resume: resume.id,
    point: points[0].id,
    record: records[3].id,
    role: role.id,
    entry: placed[0].id,
  };
}
