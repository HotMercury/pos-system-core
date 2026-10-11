-- CreateEnum
CREATE TYPE "ProductSize" AS ENUM ('M', 'L');

-- CreateEnum
CREATE TYPE "ProductTemperature" AS ENUM ('H', 'I');

-- AlterTable
ALTER TABLE "Product"
ADD COLUMN "englishName" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "categoryOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "size" "ProductSize" NOT NULL,
    "temperature" "ProductTemperature" NOT NULL,
    "flavor" TEXT NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_size_temperature_flavor_key"
ON "ProductVariant"("productId", "size", "temperature", "flavor");

-- AlterTable
ALTER TABLE "OrderItem"
ADD COLUMN "variantId" TEXT,
ADD COLUMN "variantSize" TEXT,
ADD COLUMN "variantTemperature" TEXT,
ADD COLUMN "variantFlavor" TEXT;

-- AddForeignKey
ALTER TABLE "ProductVariant"
ADD CONSTRAINT "ProductVariant_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_variantId_fkey"
FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
