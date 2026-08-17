CREATE TABLE "draft" (
	"owner_id" uuid NOT NULL,
	"target_kind" text NOT NULL,
	"target_id" uuid NOT NULL,
	"field" text NOT NULL,
	"body" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "draft_owner_id_target_kind_target_id_field_pk" PRIMARY KEY("owner_id","target_kind","target_id","field"),
	CONSTRAINT "draft_target_kind_check" CHECK (target_kind in ('phrasing', 'record'))
);
--> statement-breakpoint
ALTER TABLE "draft" ADD CONSTRAINT "draft_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;