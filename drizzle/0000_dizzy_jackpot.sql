DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'InviteStatus' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."InviteStatus" AS ENUM('PENDING', 'ACCEPTED', 'DECLINED');
  END IF;
END $$;--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_providerAccountId_unique" UNIQUE("provider","providerAccountId")
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
	"createdAt" timestamp DEFAULT now() NOT NULL,
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
	"createdAt" timestamp DEFAULT now() NOT NULL,
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
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "organization_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"organizationId" text NOT NULL,
	"invitedBy" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
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
	"createdAt" timestamp DEFAULT now() NOT NULL,
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
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"sessionToken" text NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "sessions_sessionToken_unique" UNIQUE("sessionToken")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" timestamp,
	"image" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"organizationId" text,
	"isAdmin" boolean DEFAULT false NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
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