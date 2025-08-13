/*
  Warnings:

  - A unique constraint covering the columns `[token]` on the table `organization_self_serve_invites` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "organization_self_serve_invites" ADD COLUMN     "token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "organization_self_serve_invites_token_key" ON "organization_self_serve_invites"("token");
