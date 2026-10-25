-- CreateEnum
CREATE TYPE "CustomerSegment" AS ENUM ('GENERAL', 'MEDICAL');

-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "customerSegment" "CustomerSegment" NOT NULL DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE "Promotion"
ADD COLUMN "isMedical" BOOLEAN NOT NULL DEFAULT false;
