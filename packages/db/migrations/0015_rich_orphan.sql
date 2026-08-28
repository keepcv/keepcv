CREATE TABLE "role_profile" (
	"id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"name" text NOT NULL,
	"sort_key" text NOT NULL,
	CONSTRAINT "role_profile_owner_id_id_pk" PRIMARY KEY("owner_id","id")
);
--> statement-breakpoint
CREATE TABLE "role_profile_tag" (
	"owner_id" uuid NOT NULL,
	"role_profile_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "role_profile_tag_owner_id_role_profile_id_tag_id_pk" PRIMARY KEY("owner_id","role_profile_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "role_profile" ADD CONSTRAINT "role_profile_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_profile_tag" ADD CONSTRAINT "role_profile_tag_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_profile_tag" ADD CONSTRAINT "role_profile_tag_profile_fk" FOREIGN KEY ("owner_id","role_profile_id") REFERENCES "public"."role_profile"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_profile_tag" ADD CONSTRAINT "role_profile_tag_tag_fk" FOREIGN KEY ("owner_id","tag_id") REFERENCES "public"."tag"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "role_profile_sort_key_unique" ON "role_profile" USING btree ("owner_id","sort_key");--> statement-breakpoint
CREATE INDEX "role_profile_tag_tag_idx" ON "role_profile_tag" USING btree ("owner_id","tag_id");