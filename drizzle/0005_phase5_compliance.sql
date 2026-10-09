CREATE TYPE "public"."performer_status" AS ENUM('draft', 'verified', 'retired');--> statement-breakpoint
CREATE TYPE "public"."vault_document_kind" AS ENUM('id_front', 'id_back', 'selfie_with_id', 'model_release', 'consent', 'other');--> statement-breakpoint
CREATE TABLE "media_performers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid,
	"media_ref" uuid NOT NULL,
	"post_title_snapshot" text NOT NULL,
	"performer_id" uuid NOT NULL,
	"production_date" date NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_name" text NOT NULL,
	"status" "performer_status" DEFAULT 'draft' NOT NULL,
	"pii_ciphertext" "bytea" NOT NULL,
	"key_version" text NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"performer_id" uuid NOT NULL,
	"kind" "vault_document_kind" NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"ciphertext" "bytea" NOT NULL,
	"key_version" text NOT NULL,
	"uploaded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_performers" ADD CONSTRAINT "media_performers_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_performers" ADD CONSTRAINT "media_performers_performer_id_performers_id_fk" FOREIGN KEY ("performer_id") REFERENCES "public"."performers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_performers" ADD CONSTRAINT "media_performers_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performers" ADD CONSTRAINT "performers_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_documents" ADD CONSTRAINT "vault_documents_performer_id_performers_id_fk" FOREIGN KEY ("performer_id") REFERENCES "public"."performers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_documents" ADD CONSTRAINT "vault_documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_performers_ref_performer_idx" ON "media_performers" USING btree ("media_ref","performer_id");--> statement-breakpoint
CREATE INDEX "media_performers_media_idx" ON "media_performers" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "media_performers_performer_idx" ON "media_performers" USING btree ("performer_id");--> statement-breakpoint
CREATE INDEX "vault_documents_performer_idx" ON "vault_documents" USING btree ("performer_id");