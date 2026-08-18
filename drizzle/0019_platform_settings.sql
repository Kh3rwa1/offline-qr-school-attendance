CREATE TABLE IF NOT EXISTS "platform_settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "platform_settings" ("key", "value") VALUES
  ('pricing_amount',      '₹130'),
  ('pricing_per_student', 'per student / year'),
  ('pricing_free_note',   'Schools under 300 students — free forever'),
  ('testimonial_1_quote', '"Roll call used to take 20 minutes every morning. Now it''s done before the first bell rings."'),
  ('testimonial_1_name',  'Ranjit Kumar Das'),
  ('testimonial_1_role',  'Headmaster, Khatra High School (H.S.), Bankura'),
  ('testimonial_1_count', '840 students'),
  ('testimonial_2_quote', '"Even on days when the internet is out, teachers take attendance on their phones and it uploads itself later. Parents get the SMS automatically."'),
  ('testimonial_2_name',  'Sunita Mahato'),
  ('testimonial_2_role',  'School Admin, Purulia Zilla School'),
  ('testimonial_2_count', '1,200 students'),
  ('demo_video_url',      ''),
  ('hero_subtitle',       'Scan a card — one second per student. No internet needed. UDISE+ reports ready to download.')
ON CONFLICT ("key") DO NOTHING;
