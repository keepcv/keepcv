CREATE TABLE "resume" (
	"id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"name" text NOT NULL,
	"target_company" text,
	"target_role" text,
	"target_url" text,
	"target_jd_text" text,
	"applied_on" "partial_date",
	CONSTRAINT "resume_owner_id_id_pk" PRIMARY KEY("owner_id","id")
);
--> statement-breakpoint
CREATE TABLE "resume_contact_channel" (
	"owner_id" uuid NOT NULL,
	"resume_id" uuid NOT NULL,
	"contact_channel_id" uuid NOT NULL,
	"is_visible" boolean NOT NULL,
	CONSTRAINT "resume_contact_channel_owner_id_resume_id_contact_channel_id_pk" PRIMARY KEY("owner_id","resume_id","contact_channel_id")
);
--> statement-breakpoint
CREATE TABLE "resume_entry" (
	"id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"resume_id" uuid NOT NULL,
	"resume_section_id" uuid NOT NULL,
	"record_id" uuid NOT NULL,
	"sort_key" text NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	CONSTRAINT "resume_entry_owner_id_id_pk" PRIMARY KEY("owner_id","id"),
	CONSTRAINT "resume_entry_member_unique" UNIQUE("owner_id","resume_id","id"),
	CONSTRAINT "resume_entry_record_unique" UNIQUE("owner_id","resume_section_id","record_id"),
	CONSTRAINT "resume_entry_sort_key_unique" UNIQUE("owner_id","resume_section_id","sort_key")
);
--> statement-breakpoint
CREATE TABLE "resume_entry_point" (
	"id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"resume_id" uuid NOT NULL,
	"resume_entry_id" uuid NOT NULL,
	"point_id" uuid NOT NULL,
	"phrasing_id" uuid NOT NULL,
	"sort_key" text NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	CONSTRAINT "resume_entry_point_owner_id_id_pk" PRIMARY KEY("owner_id","id"),
	CONSTRAINT "resume_entry_point_unique" UNIQUE("owner_id","resume_id","point_id"),
	CONSTRAINT "resume_entry_point_sort_key_unique" UNIQUE("owner_id","resume_entry_id","sort_key")
);
--> statement-breakpoint
CREATE TABLE "resume_section" (
	"id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"resume_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"custom_section_id" uuid,
	"heading" text,
	"layout" text,
	"sort_key" text NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	CONSTRAINT "resume_section_owner_id_id_pk" PRIMARY KEY("owner_id","id"),
	CONSTRAINT "resume_section_member_unique" UNIQUE("owner_id","resume_id","id"),
	CONSTRAINT "resume_section_sort_key_unique" UNIQUE("owner_id","resume_id","sort_key"),
	CONSTRAINT "resume_section_kind_unique" UNIQUE NULLS NOT DISTINCT("owner_id","resume_id","kind","custom_section_id"),
	CONSTRAINT "resume_section_kind_check" CHECK (kind in ('experience', 'education', 'project', 'skill', 'certification', 'publication', 'award', 'language', 'volunteering', 'speaking', 'custom')),
	CONSTRAINT "resume_section_layout_check" CHECK (layout is null or layout in ('entries', 'inline', 'grouped')),
	CONSTRAINT "resume_section_custom_check" CHECK ((kind = 'custom') = (custom_section_id is not null))
);
--> statement-breakpoint
ALTER TABLE "resume" ADD CONSTRAINT "resume_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_contact_channel" ADD CONSTRAINT "resume_contact_channel_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_contact_channel" ADD CONSTRAINT "resume_contact_channel_resume_fk" FOREIGN KEY ("owner_id","resume_id") REFERENCES "public"."resume"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_contact_channel" ADD CONSTRAINT "resume_contact_channel_channel_fk" FOREIGN KEY ("owner_id","contact_channel_id") REFERENCES "public"."contact_channel"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_entry" ADD CONSTRAINT "resume_entry_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_entry" ADD CONSTRAINT "resume_entry_section_fk" FOREIGN KEY ("owner_id","resume_id","resume_section_id") REFERENCES "public"."resume_section"("owner_id","resume_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_entry" ADD CONSTRAINT "resume_entry_record_fk" FOREIGN KEY ("owner_id","record_id") REFERENCES "public"."record"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_entry_point" ADD CONSTRAINT "resume_entry_point_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_entry_point" ADD CONSTRAINT "resume_entry_point_entry_fk" FOREIGN KEY ("owner_id","resume_id","resume_entry_id") REFERENCES "public"."resume_entry"("owner_id","resume_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_entry_point" ADD CONSTRAINT "resume_entry_point_point_fk" FOREIGN KEY ("owner_id","point_id") REFERENCES "public"."point"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_entry_point" ADD CONSTRAINT "resume_entry_point_phrasing_fk" FOREIGN KEY ("owner_id","phrasing_id") REFERENCES "public"."phrasing"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_section" ADD CONSTRAINT "resume_section_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_section" ADD CONSTRAINT "resume_section_resume_fk" FOREIGN KEY ("owner_id","resume_id") REFERENCES "public"."resume"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_section" ADD CONSTRAINT "resume_section_custom_section_fk" FOREIGN KEY ("owner_id","custom_section_id") REFERENCES "public"."custom_section"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resume_entry_record_idx" ON "resume_entry" USING btree ("owner_id","record_id");--> statement-breakpoint
CREATE INDEX "resume_entry_point_point_idx" ON "resume_entry_point" USING btree ("owner_id","point_id");