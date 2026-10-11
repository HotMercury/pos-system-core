const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.table.createMany({
    data: [{ number: "A1" }, { number: "A2" }, { number: "A3" }],
    skipDuplicates: true,
  });

  const products = [
    {
      name: "濃縮咖啡",
      englishName: "Espresso",
      category: "ESPRESSO CLASSICS / 經典咖啡",
      categoryOrder: 1,
      displayOrder: 1,
      variants: [{ size: "M", temperature: "H", price: 85 }],
    },
    {
      name: "美式咖啡",
      englishName: "Americano",
      category: "ESPRESSO CLASSICS / 經典咖啡",
      categoryOrder: 1,
      displayOrder: 2,
      variants: [
        { size: "M", temperature: "H", price: 100 },
        { size: "L", temperature: "H", price: 115 },
        { size: "M", temperature: "I", price: 100 },
        { size: "L", temperature: "I", price: 115 },
      ],
    },
    {
      name: "卡布奇諾",
      englishName: "Cappuccino",
      description: "Espresso、熱牛奶、細緻奶泡",
      category: "ESPRESSO CLASSICS / 經典咖啡",
      categoryOrder: 1,
      displayOrder: 3,
      variants: [
        { size: "M", temperature: "H", price: 120 },
        { size: "L", temperature: "H", price: 140 },
      ],
    },
    {
      name: "拿鐵",
      englishName: "Caffè Latte",
      description: "Espresso、牛奶",
      category: "ESPRESSO CLASSICS / 經典咖啡",
      categoryOrder: 1,
      displayOrder: 4,
      variants: [
        { size: "M", temperature: "H", price: 130 },
        { size: "L", temperature: "H", price: 150 },
        { size: "M", temperature: "I", price: 130 },
        { size: "L", temperature: "I", price: 150 },
      ],
    },
    {
      name: "風味拿鐵",
      englishName: "Flavored Caffè Latte",
      description: "Espresso、牛奶、風味糖漿",
      category: "ESPRESSO CLASSICS / 經典咖啡",
      categoryOrder: 1,
      displayOrder: 5,
      variants: [
        ...["香草", "榛果", "焦糖"].flatMap((flavor) => [
          { size: "M", temperature: "H", flavor, price: 135 },
          { size: "L", temperature: "H", flavor, price: 155 },
          { size: "M", temperature: "I", flavor, price: 135 },
          { size: "L", temperature: "I", flavor, price: 155 },
        ]),
      ],
    },
    {
      name: "摩卡",
      englishName: "Caffè Mocha",
      description: "Espresso、巧克力、牛奶",
      category: "ESPRESSO CLASSICS / 經典咖啡",
      categoryOrder: 1,
      displayOrder: 6,
      variants: [
        { size: "M", temperature: "H", price: 135 },
        { size: "L", temperature: "H", price: 155 },
        { size: "M", temperature: "I", price: 135 },
        { size: "L", temperature: "I", price: 155 },
      ],
    },
    {
      name: "維也納咖啡",
      englishName: "Vienna Coffee",
      description: "黑咖啡、鮮奶油",
      category: "COFFEE & DESSERT / 甜點咖啡",
      categoryOrder: 2,
      displayOrder: 1,
      variants: [
        { size: "M", temperature: "H", price: 115 },
        { size: "L", temperature: "H", price: 135 },
        { size: "M", temperature: "I", price: 115 },
        { size: "L", temperature: "I", price: 135 },
      ],
    },
    {
      name: "阿芙佳朵．落雪",
      englishName: "Affogato",
      description: "Espresso、香草 Gelato",
      category: "COFFEE & DESSERT / 甜點咖啡",
      categoryOrder: 2,
      displayOrder: 2,
      variants: [{ size: "M", temperature: "I", price: 120 }],
    },
    {
      name: "伯爵檸光",
      englishName: "Earl Grey Espresso Fizz",
      description: "佛手柑茶香、Espresso、檸檬與氣泡",
      category: "HOUSE SIGNATURES / 巷弄咖啡特調",
      categoryOrder: 3,
      displayOrder: 1,
      variants: [{ size: "L", temperature: "I", price: 170 }],
    },
    {
      name: "蜜香肉桂雲朵拿鐵",
      englishName: "Honey Cinnamon Cloud Latte",
      description: "Espresso、蜂蜜、肉桂、輕盈奶泡",
      category: "HOUSE SIGNATURES / 巷弄咖啡特調",
      categoryOrder: 3,
      displayOrder: 2,
      variants: [
        { size: "M", temperature: "I", price: 130 },
        { size: "L", temperature: "I", price: 150 },
      ],
    },
    {
      name: "太妃糖瑪奇朵",
      englishName: "Butterscotch Macchiato",
      description: "Espresso、牛奶、特製太妃焦糖",
      category: "HOUSE SIGNATURES / 巷弄咖啡特調",
      categoryOrder: 3,
      displayOrder: 3,
      variants: [
        { size: "M", temperature: "H", price: 140 },
        { size: "L", temperature: "H", price: 160 },
        { size: "M", temperature: "I", price: 140 },
        { size: "L", temperature: "I", price: 160 },
      ],
    },
    {
      name: "漫遊可可冰沙",
      englishName: "Cocoa Frappé",
      category: "HOUSE SIGNATURES / 巷弄咖啡特調",
      categoryOrder: 3,
      displayOrder: 4,
      variants: [{ size: "L", temperature: "I", price: 170 }],
    },
  ];

  for (const product of products) {
    const existing = await prisma.product.findFirst({
      where: { name: product.name, category: product.category },
    });

    const { variants, ...productData } = product;
    const basePrice = variants[0].price;

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: { ...productData, price: basePrice },
      });
      for (const variant of variants) {
        await prisma.productVariant.upsert({
          where: {
            productId_size_temperature_flavor: {
              productId: existing.id,
              size: variant.size,
              temperature: variant.temperature,
              flavor: variant.flavor || "",
            },
          },
          update: { price: variant.price, isAvailable: true },
          create: {
            productId: existing.id,
            ...variant,
            flavor: variant.flavor || "",
          },
        });
      }
    } else {
      const created = await prisma.product.create({
        data: { ...productData, price: basePrice },
      });
      await prisma.productVariant.createMany({
        data: variants.map((variant) => ({
          productId: created.id,
          ...variant,
          flavor: variant.flavor || "",
        })),
      });
    }
  }

  await prisma.product.updateMany({
    where: { name: "牛肉麵" },
    data: { isAvailable: false },
  });

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
