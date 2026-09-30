CREATE TABLE "supplier_accounts" (
	"id" uuid PRIMARY KEY,
	"supplier_id" uuid NOT NULL,
	"username" varchar(100) NOT NULL UNIQUE,
	"password_hash" varchar(255) NOT NULL,
	"supplier_token" varchar(500),
	"email" varchar(255),
	"role" varchar(50) DEFAULT 'SUPPLIER_USER' NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"metadata" varchar(1000),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_settings" (
	"id" uuid PRIMARY KEY,
	"supplier_id" uuid NOT NULL,
	"base_url" varchar(500) NOT NULL,
	"rate_limit_rpm" integer DEFAULT 60,
	"timeout_seconds" integer DEFAULT 30,
	"execution_mode" varchar(50) DEFAULT 'ASYNC_CALLBACK',
	"polling_interval_sec" integer DEFAULT 5,
	"max_polling_retries" integer DEFAULT 10,
	"connection_params" jsonb,
	"whitelist_ips" jsonb,
	"callback_webhook_url" varchar(500),
	"metadata" varchar(1000),
	"status" varchar(50) DEFAULT 'ACTIVE',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_jobs" (
	"id" uuid PRIMARY KEY,
	"transaction_id" uuid NOT NULL,
	"queue_name" varchar(100) NOT NULL,
	"job_id" varchar(100) NOT NULL,
	"execution_mode" varchar(50) DEFAULT 'ASYNC_CALLBACK',
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"total_duration_ms" integer,
	"next_poll_at" timestamp with time zone,
	"last_polled_at" timestamp with time zone,
	"last_raw_response" jsonb,
	"status" varchar(50) DEFAULT 'PENDING',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_step_logs" (
	"id" uuid PRIMARY KEY,
	"transaction_id" uuid NOT NULL,
	"step" varchar(100) NOT NULL,
	"direction" varchar(50) NOT NULL,
	"http_status" integer,
	"duration_ms" integer,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "variant_id" uuid;--> statement-breakpoint
ALTER TABLE "transaction_jobs" ADD CONSTRAINT "transaction_jobs_transaction_id_transactions_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "transaction_step_logs" ADD CONSTRAINT "transaction_step_logs_transaction_id_transactions_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE;