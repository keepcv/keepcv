import { customType } from "drizzle-orm/pg-core";

// The `partial_date` domain, created by its own migration. Drizzle has no
// built-in for a Postgres domain, so the column type is named directly and the
// value passes through as the text it already is.
export const partialDate = customType<{ data: string; driverData: string }>({
  dataType: () => "partial_date",
});
