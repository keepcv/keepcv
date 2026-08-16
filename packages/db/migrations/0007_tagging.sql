CREATE TABLE "point_tag" (
	"owner_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"point_id" uuid NOT NULL,
	CONSTRAINT "point_tag_owner_id_tag_id_point_id_pk" PRIMARY KEY("owner_id","tag_id","point_id")
);
--> statement-breakpoint
CREATE TABLE "record_tag" (
	"owner_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"record_id" uuid NOT NULL,
	CONSTRAINT "record_tag_owner_id_tag_id_record_id_pk" PRIMARY KEY("owner_id","tag_id","record_id")
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"category" text,
	CONSTRAINT "tag_owner_id_id_pk" PRIMARY KEY("owner_id","id")
);
--> statement-breakpoint
ALTER TABLE "point_tag" ADD CONSTRAINT "point_tag_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_tag" ADD CONSTRAINT "point_tag_tag_fk" FOREIGN KEY ("owner_id","tag_id") REFERENCES "public"."tag"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_tag" ADD CONSTRAINT "point_tag_point_fk" FOREIGN KEY ("owner_id","point_id") REFERENCES "public"."point"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_tag" ADD CONSTRAINT "record_tag_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_tag" ADD CONSTRAINT "record_tag_tag_fk" FOREIGN KEY ("owner_id","tag_id") REFERENCES "public"."tag"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_tag" ADD CONSTRAINT "record_tag_record_fk" FOREIGN KEY ("owner_id","record_id") REFERENCES "public"."record"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "point_tag_point_idx" ON "point_tag" USING btree ("owner_id","point_id");--> statement-breakpoint
CREATE INDEX "record_tag_record_idx" ON "record_tag" USING btree ("owner_id","record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_slug_unique" ON "tag" USING btree ("owner_id","slug") WHERE "tag"."archived_at" is null;