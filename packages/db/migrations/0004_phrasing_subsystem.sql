CREATE TABLE "phrasing" (
	"id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"phrasing_set_id" uuid NOT NULL,
	"variant" text NOT NULL,
	"label" text,
	"sort_key" text NOT NULL,
	"current_revision_id" uuid,
	CONSTRAINT "phrasing_owner_id_id_pk" PRIMARY KEY("owner_id","id"),
	CONSTRAINT "phrasing_set_member_unique" UNIQUE("owner_id","id","phrasing_set_id"),
	CONSTRAINT "phrasing_variant_check" CHECK (variant in ('standard', 'short', 'long', 'angled'))
);
--> statement-breakpoint
CREATE TABLE "phrasing_revision" (
	"id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"phrasing_id" uuid NOT NULL,
	"body" jsonb NOT NULL,
	"plain_text" text NOT NULL,
	"char_count" integer NOT NULL,
	"content_hash" char(64) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "phrasing_revision_owner_id_id_pk" PRIMARY KEY("owner_id","id"),
	CONSTRAINT "phrasing_revision_member_unique" UNIQUE("owner_id","id","phrasing_id")
);
--> statement-breakpoint
CREATE TABLE "phrasing_set" (
	"id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"purpose" text NOT NULL,
	"canonical_phrasing_id" uuid,
	CONSTRAINT "phrasing_set_owner_id_id_pk" PRIMARY KEY("owner_id","id"),
	CONSTRAINT "phrasing_set_purpose_check" CHECK (purpose in ('point', 'profile_summary', 'record_summary'))
);
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "summary_set_id" uuid;--> statement-breakpoint
ALTER TABLE "record" ADD COLUMN "summary_set_id" uuid;--> statement-breakpoint
ALTER TABLE "phrasing" ADD CONSTRAINT "phrasing_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phrasing" ADD CONSTRAINT "phrasing_set_fk" FOREIGN KEY ("owner_id","phrasing_set_id") REFERENCES "public"."phrasing_set"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phrasing" ADD CONSTRAINT "phrasing_current_revision_fk" FOREIGN KEY ("owner_id","current_revision_id","id") REFERENCES "public"."phrasing_revision"("owner_id","id","phrasing_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phrasing_revision" ADD CONSTRAINT "phrasing_revision_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phrasing_revision" ADD CONSTRAINT "phrasing_revision_phrasing_fk" FOREIGN KEY ("owner_id","phrasing_id") REFERENCES "public"."phrasing"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phrasing_set" ADD CONSTRAINT "phrasing_set_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phrasing_set" ADD CONSTRAINT "phrasing_set_canonical_fk" FOREIGN KEY ("owner_id","canonical_phrasing_id","id") REFERENCES "public"."phrasing"("owner_id","id","phrasing_set_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "phrasing_sort_key_unique" ON "phrasing" USING btree ("owner_id","phrasing_set_id","sort_key");--> statement-breakpoint
CREATE INDEX "phrasing_live_idx" ON "phrasing" USING btree ("owner_id","phrasing_set_id","sort_key") WHERE "phrasing"."archived_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "phrasing_revision_content_hash_unique" ON "phrasing_revision" USING btree ("owner_id","phrasing_id","content_hash");--> statement-breakpoint
CREATE INDEX "phrasing_revision_history_idx" ON "phrasing_revision" USING btree ("owner_id","phrasing_id","created_at");--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_summary_set_fk" FOREIGN KEY ("owner_id","summary_set_id") REFERENCES "public"."phrasing_set"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record" ADD CONSTRAINT "record_summary_set_fk" FOREIGN KEY ("owner_id","summary_set_id") REFERENCES "public"."phrasing_set"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Hand-written from here: drizzle-kit does not manage triggers. Editing wording
-- appends a revision and moves a pointer (data-model.md I2), and with the rule
-- living only in the repository one stray `set` would rewrite what a resume
-- version pinned in March claims was sent.
CREATE FUNCTION phrasing_revision_is_immutable() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'phrasing_revision is append-only' USING ERRCODE = 'restrict_violation';
END;
$$;--> statement-breakpoint
CREATE TRIGGER phrasing_revision_no_update BEFORE UPDATE ON "phrasing_revision"
  FOR EACH ROW EXECUTE FUNCTION phrasing_revision_is_immutable();
