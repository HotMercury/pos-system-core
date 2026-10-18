-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('DINE_IN', 'TAKEAWAY');

-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "orderType" "OrderType" NOT NULL DEFAULT 'DINE_IN',
ADD COLUMN "pickupCode" TEXT,
ALTER COLUMN "tableId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Order_pickupCode_key" ON "Order"("pickupCode");
