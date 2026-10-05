CREATE TABLE "store_callbacks" (
	"id" uuid PRIMARY KEY,
	"transaction_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"trans_code" varchar(40) NOT NULL,
	"event" varchar(30) NOT NULL,
	"status" varchar(20) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"last_url" varchar(1000),
	"last_http_status" integer,
	"last_duration_ms" integer,
	"last_error" text,
	"last_response" text,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "callback_url" varchar(1000);--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "callback_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "callback_secret_enc" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "callback_secret_last4" varchar(4);--> statement-breakpoint
CREATE INDEX "store_callbacks_status_next_idx" ON "store_callbacks" ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "store_callbacks_transaction_idx" ON "store_callbacks" ("transaction_id","created_at");--> statement-breakpoint
CREATE INDEX "store_callbacks_merchant_idx" ON "store_callbacks" ("merchant_id","created_at");--> statement-breakpoint
ALTER TABLE "store_callbacks" ADD CONSTRAINT "store_callbacks_transaction_id_transactions_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id");--> statement-breakpoint
ALTER TABLE "store_callbacks" ADD CONSTRAINT "store_callbacks_merchant_id_merchants_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id");