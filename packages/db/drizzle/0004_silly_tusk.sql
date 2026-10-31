ALTER TABLE "lead_qualifications" ADD COLUMN "agent_score" numeric;--> statement-breakpoint
ALTER TABLE "lead_qualifications" ADD COLUMN "agent_explanation" text;--> statement-breakpoint
ALTER TABLE "lead_qualifications" ADD COLUMN "overridden_at" timestamp with time zone;--> statement-breakpoint
UPDATE "lead_qualifications" SET "agent_score" = "score", "agent_explanation" = "explanation" WHERE "agent_score" IS NULL;