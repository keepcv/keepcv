CREATE TABLE "contact_channel" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"kind" text NOT NULL,
	"label" text,
	"value" text NOT NULL,
	"is_default_visible" boolean DEFAULT true NOT NULL,
	"sort_key" text NOT NULL,
	CONSTRAINT "contact_channel_kind_check" CHECK (kind in ('email', 'phone', 'website', 'linkedin', 'github', 'scholar', 'orcid', 'location', 'other'))
);
--> statement-breakpoint
CREATE TABLE "owner" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"display_name" text,
	"last_opened_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"full_name" text,
	"pronouns" text,
	"headline" text,
	"location" text
);
--> statement-breakpoint
ALTER TABLE "contact_channel" ADD CONSTRAINT "contact_channel_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contact_channel_sort_key_unique" ON "contact_channel" USING btree ("owner_id","sort_key");--> statement-breakpoint
CREATE INDEX "contact_channel_live_idx" ON "contact_channel" USING btree ("owner_id","sort_key") WHERE "contact_channel"."archived_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "profile_owner_unique" ON "profile" USING btree ("owner_id");