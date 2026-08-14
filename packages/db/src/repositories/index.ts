import type { Repositories } from "@keepcv/core";
import type { Database } from "../database.js";
import { createCareerRecordRepository } from "./career-record.js";
import { createOrganisationRepository } from "./organisation.js";
import { createProfileRepository } from "./profile.js";

export function createRepositories(db: Database): Repositories {
  return {
    profile: createProfileRepository(db),
    organisations: createOrganisationRepository(db),
    records: createCareerRecordRepository(db),
  };
}
