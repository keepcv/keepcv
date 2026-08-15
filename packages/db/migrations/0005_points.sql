CREATE TABLE "evidence" (
	"id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"point_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"note" text,
	CONSTRAINT "evidence_owner_id_id_pk" PRIMARY KEY("owner_id","id"),
	CONSTRAINT "evidence_kind_check" CHECK (kind in ('url', 'note', 'file'))
);
--> statement-breakpoint
CREATE TABLE "metric" (
	"id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"point_id" uuid NOT NULL,
	"label" text NOT NULL,
	"value" double precision NOT NULL,
	"unit" text,
	"baseline" double precision,
	"direction" text,
	"period" text,
	"sort_key" text NOT NULL,
	CONSTRAINT "metric_owner_id_id_pk" PRIMARY KEY("owner_id","id"),
	CONSTRAINT "metric_direction_check" CHECK (direction is null or direction in ('increase', 'decrease', 'neutral'))
);
--> statement-breakpoint
CREATE TABLE "point" (
	"id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"record_id" uuid,
	"phrasing_set_id" uuid NOT NULL,
	"confidence" text DEFAULT 'unverified' NOT NULL,
	"occurred_on" "partial_date",
	"sort_key" text NOT NULL,
	CONSTRAINT "point_owner_id_id_pk" PRIMARY KEY("owner_id","id"),
	CONSTRAINT "point_sort_key_unique" UNIQUE NULLS NOT DISTINCT("owner_id","record_id","sort_key"),
	CONSTRAINT "point_confidence_check" CHECK (confidence in ('verified', 'estimated', 'unverified'))
);
--> statement-breakpoint
CREATE TABLE "point_record_link" (
	"owner_id" uuid NOT NULL,
	"point_id" uuid NOT NULL,
	"record_id" uuid NOT NULL,
	CONSTRAINT "point_record_link_owner_id_point_id_record_id_pk" PRIMARY KEY("owner_id","point_id","record_id")
);
--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_point_fk" FOREIGN KEY ("owner_id","point_id") REFERENCES "public"."point"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric" ADD CONSTRAINT "metric_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric" ADD CONSTRAINT "metric_point_fk" FOREIGN KEY ("owner_id","point_id") REFERENCES "public"."point"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point" ADD CONSTRAINT "point_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point" ADD CONSTRAINT "point_record_fk" FOREIGN KEY ("owner_id","record_id") REFERENCES "public"."record"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point" ADD CONSTRAINT "point_phrasing_set_fk" FOREIGN KEY ("owner_id","phrasing_set_id") REFERENCES "public"."phrasing_set"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_record_link" ADD CONSTRAINT "point_record_link_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_record_link" ADD CONSTRAINT "point_record_link_point_fk" FOREIGN KEY ("owner_id","point_id") REFERENCES "public"."point"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_record_link" ADD CONSTRAINT "point_record_link_record_fk" FOREIGN KEY ("owner_id","record_id") REFERENCES "public"."record"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evidence_point_idx" ON "evidence" USING btree ("owner_id","point_id");--> statement-breakpoint
CREATE UNIQUE INDEX "metric_sort_key_unique" ON "metric" USING btree ("owner_id","point_id","sort_key");--> statement-breakpoint
CREATE INDEX "point_live_idx" ON "point" USING btree ("owner_id","record_id","sort_key") WHERE "point"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "point_record_link_record_idx" ON "point_record_link" USING btree ("owner_id","record_id");