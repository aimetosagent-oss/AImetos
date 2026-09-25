ALTER TYPE "FormFieldType" ADD VALUE 'RADIO';
ALTER TYPE "FormFieldType" ADD VALUE 'MULTI_CHECKBOX';

ALTER TABLE "Form" ADD COLUMN "submitLabel" TEXT NOT NULL DEFAULT 'Enviar sol·licitud';
ALTER TABLE "Form" ALTER COLUMN "webhookEnabled" SET DEFAULT false;

ALTER TABLE "DocumentSequence" ADD COLUMN "periodKey" TEXT;

UPDATE "DocumentSequence"
SET "periodKey" = "year"::TEXT;

ALTER TABLE "DocumentSequence" ALTER COLUMN "periodKey" SET NOT NULL;
DROP INDEX "DocumentSequence_organizationId_type_year_key";
ALTER TABLE "DocumentSequence" DROP COLUMN "year";

CREATE UNIQUE INDEX "DocumentSequence_organizationId_type_periodKey_key"
ON "DocumentSequence"("organizationId", "type", "periodKey");

ALTER TABLE "OrganizationSettings" ALTER COLUMN "quotePrefix" SET DEFAULT 'PRE';
ALTER TABLE "OrganizationSettings" ALTER COLUMN "quoteNumberLength" SET DEFAULT 2;
ALTER TABLE "OrganizationSettings" ALTER COLUMN "invoicePrefix" SET DEFAULT 'FAC';
ALTER TABLE "OrganizationSettings" ALTER COLUMN "invoiceNumberLength" SET DEFAULT 2;

UPDATE "OrganizationSettings"
SET "quotePrefix" = 'PRE', "quoteNumberLength" = 2
WHERE "quotePrefix" = 'P' AND "quoteNumberLength" = 4;

UPDATE "OrganizationSettings"
SET "invoicePrefix" = 'FAC', "invoiceNumberLength" = 2
WHERE "invoicePrefix" = 'F' AND "invoiceNumberLength" = 4;
