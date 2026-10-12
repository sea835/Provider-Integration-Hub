CREATE TABLE "alert_channels" (
	"id" uuid PRIMARY KEY,
	"status" varchar(50) DEFAULT 'ACTIVE',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"metadata" jsonb,
	"type" varchar(30) NOT NULL UNIQUE,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb NOT NULL,
	"encrypted_secrets" text
);
--> statement-breakpoint
ALTER TABLE "providers" ALTER COLUMN "interval_minutes" SET DEFAULT 5;