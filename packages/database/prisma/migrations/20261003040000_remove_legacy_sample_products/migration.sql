-- Remove the original development-only products when they are not used by an order.
DELETE FROM "ProductVariant"
WHERE "productId" IN (
  SELECT "id" FROM "Product"
  WHERE "name" IN ('牛肉麵', '滷肉飯', '珍珠奶茶')
)
AND NOT EXISTS (
  SELECT 1 FROM "OrderItem"
  WHERE "OrderItem"."productId" = "ProductVariant"."productId"
);

DELETE FROM "Product"
WHERE "name" IN ('牛肉麵', '滷肉飯', '珍珠奶茶')
AND NOT EXISTS (
  SELECT 1 FROM "OrderItem"
    WHERE "OrderItem"."productId" = "Product"."id"
);

-- Keep historical rows, but hide legacy products that are referenced by orders.
UPDATE "Product"
SET "isAvailable" = false
WHERE "name" IN ('牛肉麵', '滷肉飯', '珍珠奶茶');
