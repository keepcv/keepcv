import type { Repositories } from "@keepcv/core";
import type { Database } from "../database.js";
import { createCareerRecordRepository } from "./career-record.js";
import { createCustomSectionRepository } from "./custom-section.js";
import { createOrganisationRepository } from "./organisation.js";
import { createPhrasingRepository } from "./phrasing.js";
import { createPointRepository } from "./point.js";
import { createProfileRepository } from "./profile.js";
import { createStoreRepository } from "./store.js";

export function createRepositories(db: Database): Repositories {
  const phrasings = createPhrasingRepository(db);
  const repositories = {
    profile: createProfileRepository(db),
    organisations: createOrganisationRepository(db),
    customSections: createCustomSectionRepository(db),
    records: createCareerRecordRepository(db),
    points: createPointRepository(db, phrasings),
    phrasings,
  };
  return { ...repositories, store: createStoreRepository(db, repositories) };
}
