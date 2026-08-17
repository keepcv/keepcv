import { customType } from "drizzle-orm/pg-core";

// Drizzle has no built-in for a Postgres domain, so the type is named directly.
export const partialDate = customType<{ data: string; driverData: string }>({
  dataType: () => "partial_date",
});
