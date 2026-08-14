import type { Repositories } from "@keepcv/core";
import type { Database } from "../database.js";
import { createCareerRecordRepository } from "./career-record.js";
import { createOrganisationRepository } from "./organisation.js";
import { createPhrasingRepository } from "./phrasing.js";
import { createProfileRepository } from "./profile.js";
import { createStoreRepository } from "./store.js";

export function createRepositories(db: Database): Repositories {
  const repositories = {
    profile: createProfileRepository(db),
    organisations: createOrganisationRepository(db),
    records: createCareerRecordRepository(db),
    phrasings: createPhrasingRepository(db),
  };
  return { ...repositories, store: createStoreRepository(db, repositories) };
}
