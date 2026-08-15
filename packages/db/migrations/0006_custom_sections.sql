CREATE TABLE "custom_section" (
	"id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"heading" text NOT NULL,
	"sort_key" text NOT NULL,
	CONSTRAINT "custom_section_owner_id_id_pk" PRIMARY KEY("owner_id","id")
);
--> statement-breakpoint
ALTER TABLE "record" DROP CONSTRAINT "record_kind_check";--> statement-breakpoint
DROP INDEX "record_sort_key_unique";--> statement-breakpoint
ALTER TABLE "record" ADD COLUMN "custom_section_id" uuid;--> statement-breakpoint
ALTER TABLE "custom_section" ADD CONSTRAINT "custom_section_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "custom_section_sort_key_unique" ON "custom_section" USING btree ("owner_id","sort_key");--> statement-breakpoint
ALTER TABLE "record" ADD CONSTRAINT "record_custom_section_fk" FOREIGN KEY ("owner_id","custom_section_id") REFERENCES "public"."custom_section"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record" ADD CONSTRAINT "record_sort_key_unique" UNIQUE NULLS NOT DISTINCT("owner_id","kind","custom_section_id","sort_key");--> statement-breakpoint
ALTER TABLE "record" ADD CONSTRAINT "record_custom_section_check" CHECK ((kind = 'custom_entry') = (custom_section_id is not null));--> statement-breakpoint
ALTER TABLE "record" ADD CONSTRAINT "record_kind_check" CHECK (kind in ('experience', 'education', 'project', 'skill', 'certification', 'publication', 'award', 'language', 'volunteering', 'speaking', 'custom_entry'));