ALTER TABLE "transactions" ADD COLUMN "check_window_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "check_window_base" integer DEFAULT 0 NOT NULL;