CREATE TYPE "public"."InviteStatus" AS ENUM('PENDING', 'ACCEPTED', 'DECLINED');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "accounts_provider_id_account_id_unique" UNIQUE("provider_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "boards" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"isPublic" boolean DEFAULT false NOT NULL,
	"sendSlackUpdates" boolean DEFAULT true NOT NULL,
	"organizationId" text NOT NULL,
	"createdBy" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_items" (
	"id" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"noteId" text NOT NULL,
	"slackMessageId" text,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"color" text DEFAULT '#fef3c7' NOT NULL,
	"archivedAt" timestamp,
	"slackMessageId" text,
	"boardId" text NOT NULL,
	"createdBy" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "organization_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"organizationId" text NOT NULL,
	"invitedBy" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	"status" "InviteStatus" DEFAULT 'PENDING' NOT NULL,
	CONSTRAINT "organization_invites_email_organizationId_unique" UNIQUE("email","organizationId")
);
--> statement-breakpoint
CREATE TABLE "organization_self_serve_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text,
	"name" text NOT NULL,
	"organizationId" text NOT NULL,
	"createdBy" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	"expiresAt" timestamp,
	"usageLimit" integer,
	"usageCount" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	CONSTRAINT "organization_self_serve_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slackWebhookUrl" text,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"user_id" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"organizationId" text,
	"isAdmin" boolean DEFAULT false NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verificationtokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationtokens_token_unique" UNIQUE("token"),
	CONSTRAINT "verificationtokens_identifier_token_unique" UNIQUE("identifier","token")
);
--> statement-breakpoint
CREATE INDEX "idx_board_org_created" ON "boards" USING btree ("organizationId","createdAt");--> statement-breakpoint
CREATE INDEX "checklist_items_noteId_index" ON "checklist_items" USING btree ("noteId");--> statement-breakpoint
CREATE INDEX "checklist_items_noteId_order_index" ON "checklist_items" USING btree ("noteId","order");--> statement-breakpoint
CREATE INDEX "idx_note_board_deleted" ON "notes" USING btree ("boardId","deletedAt");--> statement-breakpoint
CREATE INDEX "idx_note_board_created" ON "notes" USING btree ("boardId","createdAt");--> statement-breakpoint
CREATE INDEX "idx_note_user_deleted" ON "notes" USING btree ("createdBy","deletedAt");