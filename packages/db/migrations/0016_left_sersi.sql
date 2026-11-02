CREATE TABLE "agent_attachment" (
	"id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"conversation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"media_type" text NOT NULL,
	"data" text NOT NULL,
	CONSTRAINT "agent_attachment_owner_id_id_pk" PRIMARY KEY("owner_id","id")
);
--> statement-breakpoint
CREATE TABLE "agent_conversation" (
	"id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"title" text NOT NULL,
	"state" jsonb NOT NULL,
	CONSTRAINT "agent_conversation_owner_id_id_pk" PRIMARY KEY("owner_id","id")
);
--> statement-breakpoint
ALTER TABLE "agent_attachment" ADD CONSTRAINT "agent_attachment_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_attachment" ADD CONSTRAINT "agent_attachment_owner_id_conversation_id_agent_conversation_owner_id_id_fk" FOREIGN KEY ("owner_id","conversation_id") REFERENCES "public"."agent_conversation"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_conversation" ADD CONSTRAINT "agent_conversation_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;