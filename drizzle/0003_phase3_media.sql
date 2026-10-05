CREATE TABLE "playback_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_prefix" text,
	"watermark_nonce" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "content_type" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "size_bytes" integer;--> statement-breakpoint
ALTER TABLE "playback_grants" ADD CONSTRAINT "playback_grants_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playback_grants" ADD CONSTRAINT "playback_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "playback_grants_media_idx" ON "playback_grants" USING btree ("media_id","issued_at");--> statement-breakpoint
CREATE INDEX "playback_grants_user_idx" ON "playback_grants" USING btree ("user_id","issued_at");