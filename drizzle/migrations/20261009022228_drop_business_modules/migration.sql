ALTER TABLE "store_callbacks" DROP CONSTRAINT "store_callbacks_transaction_id_transactions_id_fkey";--> statement-breakpoint
ALTER TABLE "store_callbacks" DROP CONSTRAINT "store_callbacks_merchant_id_merchants_id_fkey";--> statement-breakpoint
ALTER TABLE "callback_events" DROP CONSTRAINT "callback_events_supplier_id_suppliers_id_fkey";--> statement-breakpoint
ALTER TABLE "transaction_events" DROP CONSTRAINT "transaction_events_transaction_id_transactions_id_fkey";--> statement-breakpoint
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_merchant_id_merchants_id_fkey";--> statement-breakpoint
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_supplier_id_suppliers_id_fkey";--> statement-breakpoint
DROP TABLE "merchants";--> statement-breakpoint
DROP TABLE "suppliers";--> statement-breakpoint
DROP TABLE "store_callbacks";--> statement-breakpoint
DROP TABLE "callback_events";--> statement-breakpoint
DROP TABLE "transaction_events";--> statement-breakpoint
DROP TABLE "transactions";