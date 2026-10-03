const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.table.createMany({
    data: [{ number: "A1" }, { number: "A2" }, { number: "A3" }],
    skipDuplicates: true,
  });

  const products = [
    { name: "牛肉麵", price: 150, category: "麵食" },
    { name: "滷肉飯", price: 60, category: "飯食" },
    { name: "珍珠奶茶", price: 55, category: "飲料" },
  ];

  for (const product of products) {
    const existing = await prisma.product.findFirst({
      where: { name: product.name, category: product.category },
    });

    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data: product });
    } else {
      await prisma.product.create({ data: product });
    }
  }

  console.log("Seed data inserted.");
}

const keepAlive = setInterval(() => undefined, 1000);

main()
  .then(async () => {
    clearInterval(keepAlive);
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    clearInterval(keepAlive);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
