CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY,
	"status" varchar(50) DEFAULT 'ACTIVE',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"metadata" jsonb,
	"code" varchar(50) NOT NULL UNIQUE,
	"name" varchar(255) NOT NULL,
	"api_key_hash" char(64) NOT NULL UNIQUE,
	"api_key_last4" varchar(4) NOT NULL,
	"ip_whitelist" jsonb DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "callback_events" (
	"id" uuid PRIMARY KEY,
	"supplier_id" uuid NOT NULL,
	"event_id" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"matched_transaction_id" uuid,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_events" (
	"id" uuid PRIMARY KEY,
	"transaction_id" uuid NOT NULL,
	"source" varchar(20) NOT NULL,
	"type" varchar(30) NOT NULL,
	"outcome" varchar(20),
	"from_status" varchar(30),
	"to_status" varchar(30),
	"config_version" integer,
	"http_status" integer,
	"duration_ms" integer,
	"message" text,
	"request" jsonb,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY,
	"status" varchar(30) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"metadata" jsonb,
	"trans_code" varchar(40) NOT NULL UNIQUE,
	"merchant_id" uuid NOT NULL,
	"partner_trans_id" varchar(64) NOT NULL,
	"request_hash" char(64) NOT NULL,
	"action" varchar(30) NOT NULL,
	"supplier_id" uuid NOT NULL,
	"supplier_code" varchar(50) NOT NULL,
	"package_code" varchar(100) NOT NULL,
	"config_version" integer NOT NULL,
	"phone" varchar(15),
	"serial" varchar(30),
	"supplier_trans_id" varchar(100),
	"submit_count" integer DEFAULT 0 NOT NULL,
	"check_count" integer DEFAULT 0 NOT NULL,
	"resubmit_requested" boolean DEFAULT false NOT NULL,
	"next_check_at" timestamp with time zone,
	"delivery" jsonb DEFAULT '{}' NOT NULL,
	"error_code" varchar(50),
	"error_message" text,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "callback_events_supplier_event_uq" ON "callback_events" ("supplier_id","event_id");--> statement-breakpoint
CREATE INDEX "transaction_events_transaction_idx" ON "transaction_events" ("transaction_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_merchant_request_uq" ON "transactions" ("merchant_id","partner_trans_id");--> statement-breakpoint
CREATE INDEX "transactions_supplier_trans_idx" ON "transactions" ("supplier_id","supplier_trans_id");--> statement-breakpoint
CREATE INDEX "transactions_status_next_check_idx" ON "transactions" ("status","next_check_at");--> statement-breakpoint
ALTER TABLE "callback_events" ADD CONSTRAINT "callback_events_supplier_id_suppliers_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id");--> statement-breakpoint
ALTER TABLE "transaction_events" ADD CONSTRAINT "transaction_events_transaction_id_transactions_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_merchant_id_merchants_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_supplier_id_suppliers_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id");