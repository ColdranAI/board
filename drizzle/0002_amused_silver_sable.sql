ALTER TABLE "accounts" DROP CONSTRAINT "accounts_provider_providerAccountId_unique";--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "accountId" text NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "providerId" text NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "accessToken" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "refreshToken" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "idToken" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "accessTokenExpiresAt" timestamp;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "refreshTokenExpiresAt" timestamp;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "password" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "createdAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "updatedAt" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "provider";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "providerAccountId";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "refresh_token";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "access_token";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "expires_at";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "token_type";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "id_token";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "session_state";--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_providerId_accountId_unique" UNIQUE("providerId","accountId");