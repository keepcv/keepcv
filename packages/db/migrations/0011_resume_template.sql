ALTER TABLE "resume" ADD COLUMN "template_id" text;--> statement-breakpoint
ALTER TABLE "resume" ADD COLUMN "template_config" jsonb DEFAULT '{}'::jsonb NOT NULL;