ALTER TABLE "customers" ADD COLUMN "contact_name" text NOT NULL DEFAULT '';
ALTER TABLE "customers" ADD COLUMN "street" text NOT NULL DEFAULT '';
ALTER TABLE "customers" ADD COLUMN "house_number" text NOT NULL DEFAULT '';
ALTER TABLE "customers" ADD COLUMN "plz" text NOT NULL DEFAULT '';
ALTER TABLE "customers" ADD COLUMN "city" text NOT NULL DEFAULT '';
ALTER TABLE "customers" ADD COLUMN "email" text NOT NULL DEFAULT '';
ALTER TABLE "customers" ADD COLUMN "phone" text NOT NULL DEFAULT '';
ALTER TABLE "customers" ADD COLUMN "account_user_id" integer;

ALTER TABLE "appointments" ADD COLUMN "event_name" text NOT NULL DEFAULT '';
ALTER TABLE "appointments" ADD COLUMN "notes" text NOT NULL DEFAULT '';
ALTER TABLE "appointments" ADD COLUMN "details_json" text NOT NULL DEFAULT '{}';

