ALTER TABLE "outreach_drafts" ADD COLUMN "rejected_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "outreach_drafts" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "outreach_drafts" ADD CONSTRAINT "outreach_drafts_rejected_by_user_id_users_user_id_fk" FOREIGN KEY ("rejected_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_drafts" ADD CONSTRAINT "outreach_drafts_decision" CHECK ((
        ("outreach_drafts"."status" IN ('draft', 'edited')
          AND "outreach_drafts"."approved_by_user_id" IS NULL
          AND "outreach_drafts"."approved_at" IS NULL
          AND "outreach_drafts"."rejected_by_user_id" IS NULL
          AND "outreach_drafts"."rejected_at" IS NULL)
        OR ("outreach_drafts"."status" = 'approved'
          AND "outreach_drafts"."approved_by_user_id" IS NOT NULL
          AND "outreach_drafts"."approved_at" IS NOT NULL
          AND "outreach_drafts"."rejected_by_user_id" IS NULL
          AND "outreach_drafts"."rejected_at" IS NULL)
        OR ("outreach_drafts"."status" = 'rejected'
          AND "outreach_drafts"."rejected_by_user_id" IS NOT NULL
          AND "outreach_drafts"."rejected_at" IS NOT NULL
          AND "outreach_drafts"."approved_by_user_id" IS NULL
          AND "outreach_drafts"."approved_at" IS NULL)
        OR ("outreach_drafts"."status" = 'sent'
          AND "outreach_drafts"."rejected_by_user_id" IS NULL
          AND "outreach_drafts"."rejected_at" IS NULL)
      ));