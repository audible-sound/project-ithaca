ALTER TABLE "email_deliveries" DROP CONSTRAINT "email_deliveries_delivery_status";--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD COLUMN "followed_up_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD COLUMN "follow_up_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD COLUMN "follow_up_status" text;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD COLUMN "close_reason" text;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_follow_up_status" CHECK ("email_deliveries"."follow_up_status" IS NULL OR "email_deliveries"."follow_up_status" IN ('open', 'snoozed', 'replied'));--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_delivery_status" CHECK ("email_deliveries"."delivery_status" IN ('queued', 'sent', 'failed', 'marked_done'));