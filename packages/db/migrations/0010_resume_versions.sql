CREATE TABLE "resume_content_ref" (
	"owner_id" uuid NOT NULL,
	"resume_version_id" uuid NOT NULL,
	"ref_kind" text NOT NULL,
	"ref_id" uuid NOT NULL,
	CONSTRAINT "resume_content_ref_owner_id_resume_version_id_ref_kind_ref_id_pk" PRIMARY KEY("owner_id","resume_version_id","ref_kind","ref_id"),
	CONSTRAINT "resume_content_ref_kind_check" CHECK (ref_kind in ('record', 'point', 'phrasing_revision', 'contact_channel'))
);
--> statement-breakpoint
CREATE TABLE "resume_snapshot" (
	"id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"resume_version_id" uuid NOT NULL,
	"label" text NOT NULL,
	"note" text,
	"starred_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resume_snapshot_owner_id_id_pk" PRIMARY KEY("owner_id","id"),
	CONSTRAINT "resume_snapshot_version_unique" UNIQUE("owner_id","resume_version_id")
);
--> statement-breakpoint
CREATE TABLE "resume_version" (
	"id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"resume_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"trigger" text NOT NULL,
	"restored_from_version_id" uuid,
	"manifest" jsonb NOT NULL,
	"manifest_hash" char(64) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resume_version_owner_id_id_pk" PRIMARY KEY("owner_id","id"),
	CONSTRAINT "resume_version_seq_unique" UNIQUE("owner_id","resume_id","seq"),
	CONSTRAINT "resume_version_trigger_check" CHECK (trigger in ('export', 'manual_save', 'restore'))
);
--> statement-breakpoint
ALTER TABLE "resume_content_ref" ADD CONSTRAINT "resume_content_ref_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_content_ref" ADD CONSTRAINT "resume_content_ref_version_fk" FOREIGN KEY ("owner_id","resume_version_id") REFERENCES "public"."resume_version"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_snapshot" ADD CONSTRAINT "resume_snapshot_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_snapshot" ADD CONSTRAINT "resume_snapshot_version_fk" FOREIGN KEY ("owner_id","resume_version_id") REFERENCES "public"."resume_version"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_version" ADD CONSTRAINT "resume_version_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_version" ADD CONSTRAINT "resume_version_resume_fk" FOREIGN KEY ("owner_id","resume_id") REFERENCES "public"."resume"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_version" ADD CONSTRAINT "resume_version_restored_from_fk" FOREIGN KEY ("owner_id","restored_from_version_id") REFERENCES "public"."resume_version"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resume_content_ref_usage_idx" ON "resume_content_ref" USING btree ("owner_id","ref_kind","ref_id");--> statement-breakpoint
-- Hand-written from here: drizzle-kit does not manage triggers. A version is a
-- record of what was sent (data-model.md I2); a stray `set` on the manifest
-- would rewrite history rather than append to it.
CREATE FUNCTION resume_version_is_immutable() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'resume_version is append-only' USING ERRCODE = 'restrict_violation';
END;
$$;--> statement-breakpoint
CREATE TRIGGER resume_version_no_update BEFORE UPDATE ON "resume_version"
  FOR EACH ROW EXECUTE FUNCTION resume_version_is_immutable();
