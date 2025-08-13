-- AlterTable
ALTER TABLE "notes" ADD COLUMN     "checklistItems" JSONB,
ADD COLUMN     "isChecklist" BOOLEAN NOT NULL DEFAULT false;
