import type { Repositories } from "@keepcv/core";
import type { Database } from "../database.js";
import { createProfileRepository } from "./profile.js";

export function createRepositories(db: Database): Repositories {
  return { profile: createProfileRepository(db) };
}
