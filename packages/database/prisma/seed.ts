import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.table.createMany({
    data: [
      { number: "A1" },
      { number: "A2" },
      { number: "A3" },
    ],
    skipDuplicates: true,
  });

  await prisma.product.createMany({
    data: [
      { name: "牛肉麵", price: 150, category: "麵食" },
      { name: "滷肉飯", price: 60, category: "飯食" },
      { name: "珍珠奶茶", price: 55, category: "飲料" },
    ],
    skipDuplicates: true,
  });

  console.log("Seed data inserted.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
