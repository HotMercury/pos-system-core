-- CreateEnum
CREATE TYPE "PromotionDiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "promotionId" TEXT,
ADD COLUMN "promotionCode" TEXT,
ADD COLUMN "subtotalAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "discountAmount" INTEGER NOT NULL DEFAULT 0;

-- Backfill existing orders
UPDATE "Order" SET "subtotalAmount" = "totalAmount";

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" "PromotionDiscountType" NOT NULL,
    "value" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "minAmount" INTEGER NOT NULL DEFAULT 0,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");

-- AddForeignKey
ALTER TABLE "Order"
ADD CONSTRAINT "Order_promotionId_fkey"
FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
