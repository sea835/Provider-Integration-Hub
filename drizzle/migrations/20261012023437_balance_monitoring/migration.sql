CREATE TABLE "balance_checks" (
	"id" uuid PRIMARY KEY,
	"provider_id" uuid NOT NULL,
	"status" varchar(20) NOT NULL,
	"balance" numeric(20,2),
	"http_status" integer,
	"latency_ms" integer,
	"error_code" varchar(50),
	"error_message" text,
	"checked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" uuid PRIMARY KEY,
	"status" varchar(50) DEFAULT 'PAUSED' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"metadata" jsonb,
	"code" varchar(50) NOT NULL UNIQUE,
	"name" varchar(255) NOT NULL,
	"config" jsonb NOT NULL,
	"encrypted_secrets" text,
	"unit_multiplier" numeric(20,6) DEFAULT '1' NOT NULL,
	"interval_minutes" integer DEFAULT 15 NOT NULL,
	"warning_threshold" numeric(20,2),
	"critical_threshold" numeric(20,2),
	"cooldown_minutes" integer DEFAULT 60 NOT NULL,
	"current_balance" numeric(20,2),
	"alert_level" varchar(20) DEFAULT 'OK' NOT NULL,
	"alert_sent_at" timestamp,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_checked_at" timestamp,
	"last_status" varchar(20)
);
--> statement-breakpoint
CREATE INDEX "balance_checks_provider_checked_idx" ON "balance_checks" ("provider_id","checked_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "balance_checks" ADD CONSTRAINT "balance_checks_provider_id_providers_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE;