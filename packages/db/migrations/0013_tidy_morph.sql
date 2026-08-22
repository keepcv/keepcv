CREATE TABLE "saved_filter" (
	"id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"query" text DEFAULT '' NOT NULL,
	"kind" text,
	"tag_id" uuid,
	"archived" text DEFAULT 'exclude' NOT NULL,
	"unfinished" text,
	"sort_key" text NOT NULL,
	CONSTRAINT "saved_filter_owner_id_id_pk" PRIMARY KEY("owner_id","id"),
	CONSTRAINT "saved_filter_subject_check" CHECK (subject in ('record', 'point')),
	CONSTRAINT "saved_filter_archived_check" CHECK (archived in ('exclude', 'include', 'only')),
	CONSTRAINT "saved_filter_kind_check" CHECK (kind is null or kind in ('experience', 'education', 'project', 'skill', 'certification', 'publication', 'award', 'language', 'volunteering', 'speaking', 'custom_entry')),
	CONSTRAINT "saved_filter_unfinished_check" CHECK (unfinished is null or unfinished in ('unplaced', 'unmeasured')),
	CONSTRAINT "saved_filter_subject_columns_check" CHECK ((subject = 'record' and unfinished is null) or (subject = 'point' and kind is null))
);
--> statement-breakpoint
ALTER TABLE "saved_filter" ADD CONSTRAINT "saved_filter_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_filter" ADD CONSTRAINT "saved_filter_tag_fk" FOREIGN KEY ("owner_id","tag_id") REFERENCES "public"."tag"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saved_filter_sort_key_unique" ON "saved_filter" USING btree ("owner_id","subject","sort_key");