import { z } from "zod";
import {
  CURRENT_SCHEMA_VERSION,
  type ExportDocument,
  exportDocumentSchema,
} from "./export-document.js";

export class UnsupportedSchemaVersionError extends Error {
  override readonly name = "UnsupportedSchemaVersionError";
}

type Migration = {
  from: number;
  to: number;
  description: string;
  migrate: (document: Record<string, unknown>) => Record<string, unknown>;
};

// Ordered and contiguous, ending at CURRENT_SCHEMA_VERSION - asserted by test.
// Empty until the format's first breaking change.
export const migrations: Migration[] = [];

const versioned = z.object({ schemaVersion: z.int() }).loose();

export function migrateDocument(document: unknown): ExportDocument {
  const envelope = versioned.safeParse(document);
  if (!envelope.success) {
    throw new UnsupportedSchemaVersionError("not a KeepCV export: no schemaVersion");
  }

  let version = envelope.data.schemaVersion;
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new UnsupportedSchemaVersionError(
      `schema version ${version} is newer than this build understands (${CURRENT_SCHEMA_VERSION}); upgrade KeepCV`,
    );
  }

  let current: Record<string, unknown> = envelope.data;
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = migrations.find((migration) => migration.from === version);
    if (step === undefined) {
      throw new UnsupportedSchemaVersionError(`no migration path from schema version ${version}`);
    }
    // The loop stamps the version rather than the migration, so a migration
    // author cannot forget to bump it.
    current = { ...step.migrate(current), schemaVersion: step.to };
    version = step.to;
  }

  return exportDocumentSchema.parse(current);
}
