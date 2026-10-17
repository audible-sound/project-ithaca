CREATE TABLE "users" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"company_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"industry" text,
	"size_band" text,
	"location" text,
	"description" text,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	CONSTRAINT "companies_size_band" CHECK ("companies"."size_band" IS NULL OR "companies"."size_band" IN ('1-10', '11-50', '51-200', '201-1000', '1000+'))
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"contact_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"job_title" text,
	"email" text,
	"phone" text,
	"linkedin_url" text,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"lead_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"primary_contact_id" uuid,
	"created_by_user_id" uuid,
	"source_type" text NOT NULL,
	"lifecycle_status" text NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	CONSTRAINT "leads_source_type" CHECK ("leads"."source_type" IN ('manual', 'identified')),
	CONSTRAINT "leads_lifecycle_status" CHECK ("leads"."lifecycle_status" IN ('new', 'identified', 'qualified', 'summarized', 'outreach_drafted', 'outreach_sent', 'needs_follow_up', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "source_references" (
	"source_reference_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"contact_id" uuid,
	"lead_id" uuid,
	"source_provider" text NOT NULL,
	"source_url" text,
	"source_title" text,
	"retrieved_at" timestamp with time zone,
	"raw_snippet" jsonb,
	CONSTRAINT "source_references_target" CHECK ("source_references"."company_id" IS NOT NULL OR "source_references"."contact_id" IS NOT NULL OR "source_references"."lead_id" IS NOT NULL),
	CONSTRAINT "source_references_source_provider" CHECK ("source_references"."source_provider" IN ('exa', 'manual', 'other'))
);
--> statement-breakpoint
CREATE TABLE "workflow_run_leads" (
	"workflow_run_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"current_stage" text NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	CONSTRAINT "workflow_run_leads_workflow_run_id_lead_id_pk" PRIMARY KEY("workflow_run_id","lead_id"),
	CONSTRAINT "workflow_run_leads_current_stage" CHECK ("workflow_run_leads"."current_stage" IN ('identify', 'qualify', 'summarize', 'draft', 'done')),
	CONSTRAINT "workflow_run_leads_status" CHECK ("workflow_run_leads"."status" IN ('pending', 'running', 'completed', 'failed', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"workflow_run_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"icp_id" uuid NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "workflow_runs_status" CHECK ("workflow_runs"."status" IN ('pending', 'running', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "workflow_steps" (
	"workflow_step_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_run_id" uuid NOT NULL,
	"step_type" text NOT NULL,
	"status" text NOT NULL,
	"attempt_count" integer NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	CONSTRAINT "workflow_steps_step_type" CHECK ("workflow_steps"."step_type" IN ('identify', 'qualify', 'summarize', 'draft')),
	CONSTRAINT "workflow_steps_status" CHECK ("workflow_steps"."status" IN ('pending', 'running', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "email_deliveries" (
	"email_delivery_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outreach_draft_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_message_id" text,
	"delivery_status" text NOT NULL,
	"error_message" text,
	"sent_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"replied_at" timestamp with time zone,
	"follow_up_due_at" timestamp with time zone,
	CONSTRAINT "email_deliveries_outreach_draft_id_unique" UNIQUE("outreach_draft_id"),
	CONSTRAINT "email_deliveries_provider" CHECK ("email_deliveries"."provider" IN ('gmail')),
	CONSTRAINT "email_deliveries_delivery_status" CHECK ("email_deliveries"."delivery_status" IN ('queued', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "lead_qualifications" (
	"qualification_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"workflow_run_id" uuid NOT NULL,
	"score" numeric,
	"priority_rank" integer,
	"priority_label" text,
	"fit_label" text,
	"explanation" text,
	"evidence" jsonb,
	"criteria_breakdown" jsonb,
	"is_user_override" boolean NOT NULL,
	"reviewed_by_user_id" uuid,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	CONSTRAINT "lead_qualifications_lead_id_unique" UNIQUE("lead_id"),
	CONSTRAINT "lead_qualifications_priority_label" CHECK ("lead_qualifications"."priority_label" IS NULL OR "lead_qualifications"."priority_label" IN ('high', 'medium', 'low'))
);
--> statement-breakpoint
CREATE TABLE "lead_summaries" (
	"summary_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"workflow_run_id" uuid NOT NULL,
	"summary_text" text NOT NULL,
	"structured_report" jsonb,
	"is_user_override" boolean NOT NULL,
	"reviewed_by_user_id" uuid,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	CONSTRAINT "lead_summaries_lead_id_unique" UNIQUE("lead_id")
);
--> statement-breakpoint
CREATE TABLE "outreach_drafts" (
	"outreach_draft_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"workflow_run_id" uuid NOT NULL,
	"subject" text,
	"body" text,
	"status" text NOT NULL,
	"is_user_edited" boolean NOT NULL,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	CONSTRAINT "outreach_drafts_status" CHECK ("outreach_drafts"."status" IN ('draft', 'edited', 'approved', 'rejected', 'sent'))
);
--> statement-breakpoint
CREATE TABLE "token_usages" (
	"token_usage_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_run_id" uuid NOT NULL,
	"workflow_step_id" uuid,
	"agent_type" text NOT NULL,
	"model_name" text,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"estimated_cost" numeric,
	"created_at" timestamp with time zone,
	CONSTRAINT "token_usages_agent_type" CHECK ("token_usages"."agent_type" IN ('identification', 'qualification', 'outreach', 'summary', 'model_layer'))
);
--> statement-breakpoint
CREATE TABLE "ideal_customer_profiles" (
	"icp_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"industries" jsonb DEFAULT '{}'::jsonb,
	"company_size_min" integer,
	"company_size_max" integer,
	"locations" jsonb DEFAULT '{}'::jsonb,
	"budget" jsonb DEFAULT '{}'::jsonb,
	"business_need_keywords" jsonb DEFAULT '{}'::jsonb,
	"outreach_tone" text,
	"message_constraints" text,
	"other_criteria" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	CONSTRAINT "ideal_customer_profiles_company_size_range" CHECK ("ideal_customer_profiles"."company_size_min" IS NULL OR "ideal_customer_profiles"."company_size_max" IS NULL OR "ideal_customer_profiles"."company_size_min" <= "ideal_customer_profiles"."company_size_max")
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_company_id_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_primary_contact_id_contacts_contact_id_fk" FOREIGN KEY ("primary_contact_id") REFERENCES "public"."contacts"("contact_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_user_id_users_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_references" ADD CONSTRAINT "source_references_company_id_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_references" ADD CONSTRAINT "source_references_contact_id_contacts_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("contact_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_references" ADD CONSTRAINT "source_references_lead_id_leads_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("lead_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run_leads" ADD CONSTRAINT "workflow_run_leads_workflow_run_id_workflow_runs_workflow_run_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("workflow_run_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run_leads" ADD CONSTRAINT "workflow_run_leads_lead_id_leads_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("lead_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_icp_id_ideal_customer_profiles_icp_id_fk" FOREIGN KEY ("icp_id") REFERENCES "public"."ideal_customer_profiles"("icp_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflow_run_id_workflow_runs_workflow_run_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("workflow_run_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_outreach_draft_id_outreach_drafts_outreach_draft_id_fk" FOREIGN KEY ("outreach_draft_id") REFERENCES "public"."outreach_drafts"("outreach_draft_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_qualifications" ADD CONSTRAINT "lead_qualifications_lead_id_leads_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("lead_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_qualifications" ADD CONSTRAINT "lead_qualifications_workflow_run_id_workflow_runs_workflow_run_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("workflow_run_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_qualifications" ADD CONSTRAINT "lead_qualifications_reviewed_by_user_id_users_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_summaries" ADD CONSTRAINT "lead_summaries_lead_id_leads_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("lead_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_summaries" ADD CONSTRAINT "lead_summaries_workflow_run_id_workflow_runs_workflow_run_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("workflow_run_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_summaries" ADD CONSTRAINT "lead_summaries_reviewed_by_user_id_users_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_drafts" ADD CONSTRAINT "outreach_drafts_lead_id_leads_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("lead_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_drafts" ADD CONSTRAINT "outreach_drafts_workflow_run_id_workflow_runs_workflow_run_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("workflow_run_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_drafts" ADD CONSTRAINT "outreach_drafts_approved_by_user_id_users_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_usages" ADD CONSTRAINT "token_usages_workflow_run_id_workflow_runs_workflow_run_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("workflow_run_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_usages" ADD CONSTRAINT "token_usages_workflow_step_id_workflow_steps_workflow_step_id_fk" FOREIGN KEY ("workflow_step_id") REFERENCES "public"."workflow_steps"("workflow_step_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideal_customer_profiles" ADD CONSTRAINT "ideal_customer_profiles_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;