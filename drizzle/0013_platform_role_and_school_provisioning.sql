ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "platform_role" varchar(30);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_platform_role_idx" ON "users" ("platform_role");
--> statement-breakpoint
UPDATE "users" SET "platform_role" = 'SUPER_ADMIN' WHERE "phone_number" IN ('+919000000000', '+919000000001');
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "schools_udise_code_unique_idx" ON "schools" ("udise_code");
