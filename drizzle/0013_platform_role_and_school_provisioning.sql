ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "platform_role" varchar(30);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_platform_role_idx" ON "users" ("platform_role");
--> statement-breakpoint
UPDATE "users" SET "platform_role" = 'SUPER_ADMIN' WHERE "phone_number" IN ('+919000000000', '+919000000001');
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "schools_udise_code_unique_idx" ON "schools" ("udise_code");
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.lookup_auth_user_by_phone(text);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.lookup_auth_user_by_phone(p_phone text)
RETURNS TABLE (
  id uuid,
  full_name text,
  phone_number text,
  password_hash text,
  platform_role text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM set_config('app.is_system', 'true', true);
  RETURN QUERY
  SELECT u.id, u.full_name::text, u.phone_number::text, u.password_hash::text, u.platform_role::text, u.status::text
  FROM public.users u
  WHERE u.phone_number = p_phone
  LIMIT 1;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.lookup_auth_user_by_phone(text) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'attendance_auth') THEN
    GRANT EXECUTE ON FUNCTION public.lookup_auth_user_by_phone(text) TO attendance_auth;
  END IF;
END $$;
