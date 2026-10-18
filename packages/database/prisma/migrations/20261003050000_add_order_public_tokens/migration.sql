-- Add a per-order capability token so customers cannot query every order at a table.
ALTER TABLE "Order" ADD COLUMN "publicToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_publicToken_key" ON "Order"("publicToken");
