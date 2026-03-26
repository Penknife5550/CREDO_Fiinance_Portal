ALTER TABLE "webhook_config" ADD COLUMN "auth_type" varchar(20) DEFAULT 'NONE' NOT NULL;
ALTER TABLE "webhook_config" ADD COLUMN "auth_user" varchar(255);
ALTER TABLE "webhook_config" ADD COLUMN "auth_pass" varchar(255);
ALTER TABLE "webhook_config" ADD COLUMN "auth_header_name" varchar(255);
ALTER TABLE "webhook_config" ADD COLUMN "auth_header_value" varchar(500);
