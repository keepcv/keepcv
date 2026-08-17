import type { Repositories } from "@keepcv/core";
import type { Database } from "../database.js";
import { createCareerRecordRepository } from "./career-record.js";
import { createCustomSectionRepository } from "./custom-section.js";
import { createDraftRepository } from "./draft.js";
import { createOrganisationRepository } from "./organisation.js";
import { createPhrasingRepository } from "./phrasing.js";
import { createPointRepository } from "./point.js";
import { createProfileRepository } from "./profile.js";
import { createResumeRepository } from "./resume.js";
import { createResumeVersionRepository } from "./resume-version.js";
import { createStoreRepository } from "./store.js";
import { createTagRepository } from "./tag.js";

export function createRepositories(db: Database): Repositories {
  const phrasings = createPhrasingRepository(db);
  const repositories = {
    profile: createProfileRepository(db),
    organisations: createOrganisationRepository(db),
    customSections: createCustomSectionRepository(db),
    records: createCareerRecordRepository(db),
    points: createPointRepository(db, phrasings),
    phrasings,
    tags: createTagRepository(db),
    resumes: createResumeRepository(db),
    versions: createResumeVersionRepository(db),
    drafts: createDraftRepository(db),
  };
  return { ...repositories, store: createStoreRepository(db, repositories) };
}
