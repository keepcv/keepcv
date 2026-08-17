import { z } from "zod";

// UUIDv7 specifically: any other version silently costs the index locality.
export const uuidSchema = z.uuid({ version: "v7" }).brand<"Uuid">();

export type Uuid = z.infer<typeof uuidSchema>;
