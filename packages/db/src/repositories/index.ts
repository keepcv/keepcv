import type { Repositories } from "@keepcv/core";
import type { Database } from "../database.js";
import { createCareerRecordRepository } from "./career-record.js";
import { createOrganisationRepository } from "./organisation.js";
import { createProfileRepository } from "./profile.js";
import { createStoreRepository } from "./store.js";

export function createRepositories(db: Database): Repositories {
  const repositories = {
    profile: createProfileRepository(db),
    organisations: createOrganisationRepository(db),
    records: createCareerRecordRepository(db),
  };
  return { ...repositories, store: createStoreRepository(db, repositories) };
}
