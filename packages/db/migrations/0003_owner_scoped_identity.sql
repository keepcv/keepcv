-- Written by hand where drizzle-kit cannot help: it has no way to name the
-- primary key it is replacing, and it does not know the composite keys have to
-- be dropped and re-added around the swap because Postgres records their
-- dependency against the specific constraint they target, not against whatever
-- unique index happens to cover the columns.
ALTER TABLE "record" DROP CONSTRAINT "record_organisation_fk";--> statement-breakpoint
ALTER TABLE "record_link" DROP CONSTRAINT "record_link_record_fk";--> statement-breakpoint
ALTER TABLE "record_field" DROP CONSTRAINT "record_field_record_fk";--> statement-breakpoint
ALTER TABLE "organisation" DROP CONSTRAINT "organisation_owner_id_unique";--> statement-breakpoint
ALTER TABLE "record" DROP CONSTRAINT "record_owner_id_unique";--> statement-breakpoint
DROP INDEX "record_field_key_unique";--> statement-breakpoint
DROP INDEX "record_field_sort_key_unique";--> statement-breakpoint
DROP INDEX "record_link_sort_key_unique";--> statement-breakpoint
ALTER TABLE "contact_channel" DROP CONSTRAINT "contact_channel_pkey";--> statement-breakpoint
ALTER TABLE "organisation" DROP CONSTRAINT "organisation_pkey";--> statement-breakpoint
ALTER TABLE "profile" DROP CONSTRAINT "profile_pkey";--> statement-breakpoint
ALTER TABLE "record" DROP CONSTRAINT "record_pkey";--> statement-breakpoint
ALTER TABLE "record_field" DROP CONSTRAINT "record_field_pkey";--> statement-breakpoint
ALTER TABLE "record_link" DROP CONSTRAINT "record_link_pkey";--> statement-breakpoint
ALTER TABLE "contact_channel" ADD CONSTRAINT "contact_channel_owner_id_id_pk" PRIMARY KEY("owner_id","id");--> statement-breakpoint
ALTER TABLE "organisation" ADD CONSTRAINT "organisation_owner_id_id_pk" PRIMARY KEY("owner_id","id");--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_owner_id_id_pk" PRIMARY KEY("owner_id","id");--> statement-breakpoint
ALTER TABLE "record" ADD CONSTRAINT "record_owner_id_id_pk" PRIMARY KEY("owner_id","id");--> statement-breakpoint
ALTER TABLE "record_field" ADD CONSTRAINT "record_field_owner_id_id_pk" PRIMARY KEY("owner_id","id");--> statement-breakpoint
ALTER TABLE "record_link" ADD CONSTRAINT "record_link_owner_id_id_pk" PRIMARY KEY("owner_id","id");--> statement-breakpoint
ALTER TABLE "record" ADD CONSTRAINT "record_organisation_fk" FOREIGN KEY ("owner_id","organisation_id") REFERENCES "public"."organisation"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_field" ADD CONSTRAINT "record_field_record_fk" FOREIGN KEY ("owner_id","record_id") REFERENCES "public"."record"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_link" ADD CONSTRAINT "record_link_record_fk" FOREIGN KEY ("owner_id","record_id") REFERENCES "public"."record"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "record_field_key_unique" ON "record_field" USING btree ("owner_id","record_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "record_field_sort_key_unique" ON "record_field" USING btree ("owner_id","record_id","sort_key");--> statement-breakpoint
CREATE UNIQUE INDEX "record_link_sort_key_unique" ON "record_link" USING btree ("owner_id","record_id","sort_key");
