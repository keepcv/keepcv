CREATE TABLE "organisation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"website" text,
	"industry" text,
	"location" text,
	CONSTRAINT "organisation_owner_id_unique" UNIQUE("owner_id","id"),
	CONSTRAINT "organisation_kind_check" CHECK (kind in ('company', 'institution', 'issuer', 'publisher', 'venue', 'other'))
);
--> statement-breakpoint
CREATE TABLE "record" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"kind" text NOT NULL,
	"title" text,
	"subtitle" text,
	"organisation_id" uuid,
	"started_on" "partial_date",
	"ended_on" "partial_date",
	"is_current" boolean DEFAULT false NOT NULL,
	"location" text,
	"sort_key" text NOT NULL,
	"employment_type" text,
	"mode" text,
	"grade" text,
	"grade_scale" text,
	"thesis_title" text,
	"honours" text,
	"category" text,
	"proficiency" text,
	"credential_id" text,
	"expires_on" "partial_date",
	"doi" text,
	CONSTRAINT "record_owner_id_unique" UNIQUE("owner_id","id"),
	CONSTRAINT "record_kind_check" CHECK (kind in ('experience', 'education', 'project', 'skill', 'certification', 'publication', 'award', 'language', 'volunteering', 'speaking')),
	CONSTRAINT "record_mode_check" CHECK (mode is null or mode in ('onsite', 'hybrid', 'remote')),
	CONSTRAINT "record_proficiency_kinds_check" CHECK (kind in ('skill', 'language') or proficiency is null),
	CONSTRAINT "record_skill_proficiency_check" CHECK (kind <> 'skill' or proficiency is null or proficiency in ('familiar', 'working', 'proficient', 'expert')),
	CONSTRAINT "record_experience_columns_check" CHECK (kind = 'experience' or (employment_type is null and mode is null)),
	CONSTRAINT "record_education_columns_check" CHECK (kind = 'education' or (grade is null and grade_scale is null and thesis_title is null and honours is null)),
	CONSTRAINT "record_skill_columns_check" CHECK (kind = 'skill' or (category is null)),
	CONSTRAINT "record_certification_columns_check" CHECK (kind = 'certification' or (credential_id is null and expires_on is null)),
	CONSTRAINT "record_publication_columns_check" CHECK (kind = 'publication' or (doi is null))
);
--> statement-breakpoint
CREATE TABLE "record_field" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"record_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL,
	"value_kind" text DEFAULT 'text' NOT NULL,
	"sort_key" text NOT NULL,
	CONSTRAINT "record_field_value_kind_check" CHECK (value_kind in ('text', 'url', 'date', 'number'))
);
--> statement-breakpoint
CREATE TABLE "record_link" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"record_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"label" text,
	"url" text NOT NULL,
	"sort_key" text NOT NULL,
	CONSTRAINT "record_link_kind_check" CHECK (kind in ('repo', 'demo', 'docs', 'verify', 'recording', 'other'))
);
--> statement-breakpoint
ALTER TABLE "organisation" ADD CONSTRAINT "organisation_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record" ADD CONSTRAINT "record_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record" ADD CONSTRAINT "record_organisation_fk" FOREIGN KEY ("owner_id","organisation_id") REFERENCES "public"."organisation"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_field" ADD CONSTRAINT "record_field_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_field" ADD CONSTRAINT "record_field_record_fk" FOREIGN KEY ("owner_id","record_id") REFERENCES "public"."record"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_link" ADD CONSTRAINT "record_link_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_link" ADD CONSTRAINT "record_link_record_fk" FOREIGN KEY ("owner_id","record_id") REFERENCES "public"."record"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "record_sort_key_unique" ON "record" USING btree ("owner_id","kind","sort_key");--> statement-breakpoint
CREATE UNIQUE INDEX "record_field_key_unique" ON "record_field" USING btree ("record_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "record_field_sort_key_unique" ON "record_field" USING btree ("record_id","sort_key");--> statement-breakpoint
CREATE UNIQUE INDEX "record_link_sort_key_unique" ON "record_link" USING btree ("record_id","sort_key");