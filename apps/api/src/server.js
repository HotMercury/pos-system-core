const http = require("node:http");
const { randomBytes, randomInt } = require("node:crypto");
const ExcelJS = require("exceljs");
const fs = require("node:fs");
const path = require("node:path");
const { OrderStateMachine } = require("@pos/domain");
const { prisma } = require("@pos/database");

const port = Number(process.env.PORT || 3000);
const customerRoot = path.resolve(__dirname, "../../customer-web/public");
const kitchenRoot = path.resolve(__dirname, "../../kds-web/public");
const adminRoot = path.resolve(__dirname, "../../admin-web/public");
const adminSessions = new Set();
const legacyProductNames = ["牛肉麵", "滷肉飯", "珍珠奶茶"];

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, jsonHeaders);
  response.end(JSON.stringify(payload));
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

function serveStatic(response, root, requestPath, prefix) {
  const relativePath = requestPath.slice(prefix.length).replace(/^\/+/, "") || "index.html";
  const filePath = path.resolve(root, relativePath);
  if (!filePath.startsWith(`${root}${path.sep}`) && filePath !== root) {
    sendError(response, 403, "Forbidden");
    return true;
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }

  const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".jpg": "image/jpeg",
    ".json": "application/json; charset=utf-8",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
  };
  const contentType = contentTypes[path.extname(filePath)] || "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType });
  response.end(fs.readFileSync(filePath));
  return true;
}

async function readJson(request) {
  let body = "";

  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) {
      throw new Error("Request body is too large");
    }
  }

  if (!body) return {};

  try {
    return JSON.parse(body);
  } catch {
    throw new Error("Request body must be valid JSON");
  }
}

function productDto(product) {
  return {
    id: product.id,
    name: product.name,
    englishName: product.englishName || undefined,
    description: product.description || undefined,
    price: product.price,
    category: product.category,
    imageUrl: product.imageUrl || undefined,
    isAvailable: product.isAvailable,
    variants: product.variants
      .sort((left, right) => {
        const sizeOrder = { M: 0, L: 1 };
        const temperatureOrder = { H: 0, I: 1 };
        return sizeOrder[left.size] - sizeOrder[right.size]
          || temperatureOrder[left.temperature] - temperatureOrder[right.temperature]
          || left.flavor.localeCompare(right.flavor, "zh-Hant");
      })
      .map((variant) => ({
        id: variant.id,
        size: variant.size,
        temperature: variant.temperature,
        flavor: variant.flavor || undefined,
        price: variant.price,
        isAvailable: variant.isAvailable,
      })),
  };
}

function adminProductDto(product) {
  return {
    id: product.id,
    name: product.name,
    englishName: product.englishName || undefined,
    description: product.description || undefined,
    category: product.category,
    isAvailable: product.isAvailable,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      size: variant.size,
      temperature: variant.temperature,
      flavor: variant.flavor || undefined,
      price: variant.price,
      isAvailable: variant.isAvailable,
    })),
  };
}

function adminPromotionDto(promotion) {
  return {
    id: promotion.id,
    code: promotion.code,
    discountType: promotion.discountType,
    value: promotion.value,
    isActive: promotion.isActive,
    startsAt: promotion.startsAt?.toISOString(),
    endsAt: promotion.endsAt?.toISOString(),
    minAmount: promotion.minAmount,
    maxUses: promotion.maxUses,
    usedCount: promotion.usedCount,
    isMedical: promotion.isMedical,
  };
}

function adminToken(request) {
  const authorization = request.headers.authorization || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

function requireAdmin(request, response) {
  if (!adminSessions.has(adminToken(request))) {
    sendError(response, 401, "Admin authentication required");
    return false;
  }
  return true;
}

function orderDto(order, includePublicToken = false) {
  return {
    id: order.id,
    orderType: order.orderType,
    tableId: order.tableId || undefined,
    tableNumber: order.table?.number || undefined,
    pickupCode: order.pickupCode || undefined,
    publicToken: includePublicToken ? order.publicToken || undefined : undefined,
    promotionCode: order.promotionCode || undefined,
    customerSegment: order.customerSegment,
    subtotalAmount: order.subtotalAmount,
    discountAmount: order.discountAmount,
    totalAmount: order.totalAmount,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod || undefined,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      variantId: item.variantId || undefined,
      variantSize: item.variantSize || undefined,
      variantTemperature: item.variantTemperature || undefined,
      variantFlavor: item.variantFlavor || undefined,
      quantity: item.quantity,
      price: item.price,
      options: item.options || undefined,
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

const orderInclude = {
  table: true,
  items: { include: { product: true, variant: true } },
};

async function createOrder(body) {
  const orderType = body.orderType === "TAKEAWAY" ? "TAKEAWAY" : "DINE_IN";
  if (orderType === "DINE_IN" && (typeof body.tableNumber !== "string" || !body.tableNumber.trim())) {
    throw new Error("tableNumber is required for dine-in orders");
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new Error("At least one order item is required");
  }

  const quantities = new Map();
  for (const item of body.items) {
    if (typeof item?.variantId !== "string" || !Number.isInteger(item.quantity)) {
      throw new Error("Each item requires a variantId and integer quantity");
    }
    if (item.quantity < 1 || item.quantity > 99) {
      throw new Error("Quantity must be between 1 and 99");
    }
    quantities.set(
      item.variantId,
      (quantities.get(item.variantId) || 0) + item.quantity
    );
  }

  return prisma.$transaction(async (transaction) => {
    const table = orderType === "DINE_IN"
      ? await transaction.table.findUnique({ where: { number: body.tableNumber.trim() } })
      : null;
    if (orderType === "DINE_IN" && !table) throw new Error("Table not found");

    const variants = await transaction.productVariant.findMany({
      where: { id: { in: [...quantities.keys()] } },
      include: { product: true },
    });
    const variantsById = new Map(variants.map((variant) => [variant.id, variant]));

    const lines = [...quantities.entries()].map(([variantId, quantity]) => {
      const variant = variantsById.get(variantId);
      if (!variant || !variant.isAvailable || !variant.product.isAvailable) {
        throw new Error("One or more products are unavailable");
      }
      return {
        productId: variant.productId,
        variantId: variant.id,
        variantSize: variant.size,
        variantTemperature: variant.temperature,
        variantFlavor: variant.flavor || null,
        options: [variant.temperature, variant.size, variant.flavor]
          .filter(Boolean)
          .join(" / "),
        quantity,
        price: variant.price,
      };
    });

    const subtotalAmount = lines.reduce(
      (total, line) => total + line.price * line.quantity,
      0
    );

    let promotion;
    let discountAmount = 0;
    const promoCode = typeof body.promoCode === "string" ? body.promoCode.trim().toUpperCase() : "";
    if (promoCode) {
      promotion = await transaction.promotion.findUnique({ where: { code: promoCode } });
      const now = new Date();
      if (!promotion || !promotion.isActive
        || (promotion.startsAt && promotion.startsAt > now)
        || (promotion.endsAt && promotion.endsAt < now)
        || subtotalAmount < promotion.minAmount) {
        throw new Error("優惠碼無效或不符合使用條件");
      }
      if (promotion.maxUses !== null && promotion.usedCount >= promotion.maxUses) {
        throw new Error("優惠碼已達使用上限");
      }
      discountAmount = promotion.discountType === "PERCENTAGE"
        ? Math.round(subtotalAmount * promotion.value / 100)
        : Math.min(subtotalAmount, promotion.value);
      const usage = await transaction.promotion.updateMany({
        where: {
          id: promotion.id,
          ...(promotion.maxUses !== null ? { usedCount: { lt: promotion.maxUses } } : {}),
        },
        data: { usedCount: { increment: 1 } },
      });
      if (usage.count !== 1) throw new Error("優惠碼已達使用上限");
    }

    const totalAmount = subtotalAmount - discountAmount;

    let pickupCode;
    if (orderType === "TAKEAWAY") {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = `T${randomInt(1000, 10000)}`;
        const existing = await transaction.order.findUnique({ where: { pickupCode: candidate } });
        if (!existing) {
          pickupCode = candidate;
          break;
        }
      }
      if (!pickupCode) throw new Error("Unable to create pickup code");
    }

    let publicToken;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = randomBytes(24).toString("hex");
      const existing = await transaction.order.findUnique({ where: { publicToken: candidate } });
      if (!existing) {
        publicToken = candidate;
        break;
      }
    }
    if (!publicToken) throw new Error("Unable to create order token");

    const order = await transaction.order.create({
      data: {
        orderType,
        ...(table ? { tableId: table.id } : {}),
        ...(pickupCode ? { pickupCode } : {}),
        publicToken,
        ...(promotion ? { promotionId: promotion.id, promotionCode: promotion.code } : {}),
        customerSegment: promotion?.isMedical ? "MEDICAL" : "GENERAL",
        subtotalAmount,
        discountAmount,
        totalAmount,
        paymentMethod: "CASH",
        items: { create: lines },
      },
      include: orderInclude,
    });

    return orderDto(order, true);
  });
}

async function getOrderByToken(publicToken) {
  const order = await prisma.order.findUnique({
    where: { publicToken },
    include: orderInclude,
  });
  return order ? orderDto(order, true) : null;
}

async function getKitchenOrders() {
  const orders = await prisma.order.findMany({
    where: { status: { in: ["CREATED", "PREPARING", "COMPLETED"] } },
    orderBy: { createdAt: "desc" },
    include: orderInclude,
  });
  return orders.map(orderDto);
}

async function getAdminProducts() {
  const products = await prisma.product.findMany({
    where: { name: { notIn: legacyProductNames } },
    orderBy: [{ categoryOrder: "asc" }, { displayOrder: "asc" }],
    include: { variants: true },
  });
  return products.map(adminProductDto);
}

async function getAdminPromotions() {
  const promotions = await prisma.promotion.findMany({ orderBy: { createdAt: "desc" } });
  return promotions.map(adminPromotionDto);
}

function promotionData(body) {
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const discountType = body.discountType === "FIXED" ? "FIXED" : "PERCENTAGE";
  const value = Number(body.value);
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw new Error("優惠碼只能使用 3-30 位英數字、底線或連字號");
  if (!Number.isInteger(value) || value < 0 || (discountType === "PERCENTAGE" && value > 100)) {
    throw new Error("優惠值不符合規則");
  }

  const minAmount = body.minAmount === undefined ? 0 : Number(body.minAmount);
  const maxUses = body.maxUses === "" || body.maxUses === null || body.maxUses === undefined
    ? null
    : Number(body.maxUses);
  if (!Number.isInteger(minAmount) || minAmount < 0 || (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1))) {
    throw new Error("最低消費或使用上限不符合規則");
  }

  return {
    code,
    discountType,
    value,
    minAmount,
    maxUses,
    isMedical: body.isMedical === true,
    isActive: body.isActive !== false,
    startsAt: body.startsAt ? new Date(body.startsAt) : null,
    endsAt: body.endsAt ? new Date(body.endsAt) : null,
  };
}

async function createPromotion(body) {
  return adminPromotionDto(await prisma.promotion.create({ data: promotionData(body) }));
}

async function updatePromotion(id, body) {
  return adminPromotionDto(await prisma.promotion.update({ where: { id }, data: promotionData(body) }));
}

function reportRange(period, value) {
  if (period === "daily" && /^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    const start = new Date(`${value}T00:00:00+08:00`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end, label: value };
  }
  if (period === "monthly" && /^\d{4}-\d{2}$/.test(value || "")) {
    const [year, month] = value.split("-").map(Number);
    const start = new Date(`${value}-01T00:00:00+08:00`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    return { start, end, label: `${year}年${month}月` };
  }
  throw new Error("報表日期格式不正確");
}

async function buildReport(period, value) {
  const range = reportRange(period, value);
  const orders = await prisma.order.findMany({
    where: {
      status: "COMPLETED",
      createdAt: { gte: range.start, lt: range.end },
    },
    orderBy: { createdAt: "asc" },
    include: { items: { include: { product: true, variant: true } } },
  });
  const rowMap = new Map();
  let cups = 0;
  let subtotalAmount = 0;
  let discountAmount = 0;
  let totalAmount = 0;
  let generalCups = 0;
  let medicalCups = 0;

  for (const order of orders) {
    subtotalAmount += order.subtotalAmount;
    discountAmount += order.discountAmount;
    totalAmount += order.totalAmount;
    for (const item of order.items) {
      cups += item.quantity;
      if (order.customerSegment === "MEDICAL") medicalCups += item.quantity;
      else generalCups += item.quantity;
      const key = [
        order.customerSegment,
        item.productId,
        item.variantTemperature,
        item.variantSize,
        item.variantFlavor || "",
      ].join("|");
      const current = rowMap.get(key) || {
        customerSegment: order.customerSegment,
        category: item.product.category,
        productName: item.product.name,
        englishName: item.product.englishName || "",
        temperature: item.variantTemperature || "",
        size: item.variantSize || "",
        flavor: item.variantFlavor || "",
        quantity: 0,
        grossAmount: 0,
      };
      current.quantity += item.quantity;
      current.grossAmount += item.price * item.quantity;
      rowMap.set(key, current);
    }
  }

  return {
    period,
    label: range.label,
    summary: {
      orderCount: orders.length,
      cups,
      generalCups,
      medicalCups,
      subtotalAmount,
      discountAmount,
      totalAmount,
    },
    rows: [...rowMap.values()],
  };
}

async function reportWorkbook(report) {
  const workbook = new ExcelJS.Workbook();
  const summarySheet = workbook.addWorksheet("月結總表");
  summarySheet.columns = [
    { header: "項目", key: "name", width: 22 },
    { header: "數值", key: "value", width: 18 },
  ];
  summarySheet.addRows([
    { name: "報表期間", value: report.label },
    { name: "完成訂單數", value: report.summary.orderCount },
    { name: "總杯數", value: report.summary.cups },
    { name: "一般客杯數", value: report.summary.generalCups },
    { name: "醫美客杯數", value: report.summary.medicalCups },
    { name: "折扣前金額", value: report.summary.subtotalAmount },
    { name: "優惠折扣", value: report.summary.discountAmount },
    { name: "實收金額", value: report.summary.totalAmount },
  ]);

  const drinkSheet = workbook.addWorksheet("每日飲品");
  drinkSheet.columns = [
    { header: "客群", key: "customerSegment", width: 12 },
    { header: "分類", key: "category", width: 28 },
    { header: "品項", key: "productName", width: 18 },
    { header: "英文名", key: "englishName", width: 24 },
    { header: "溫度", key: "temperature", width: 10 },
    { header: "尺寸", key: "size", width: 10 },
    { header: "風味", key: "flavor", width: 12 },
    { header: "杯數", key: "quantity", width: 10 },
    { header: "折扣前金額", key: "grossAmount", width: 16 },
  ];
  drinkSheet.addRows(report.rows.map((row) => ({
    ...row,
    customerSegment: row.customerSegment === "MEDICAL" ? "醫美" : "一般",
  })));

  for (const sheet of [summarySheet, drinkSheet]) {
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF806D61" } };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }
  return workbook.xlsx.writeBuffer();
}

async function updateProductAvailability(id, isAvailable) {
  const product = await prisma.product.update({
    where: { id },
    data: { isAvailable },
    include: { variants: true },
  });
  return adminProductDto(product);
}

async function updateVariant(id, body) {
  const data = {};
  if (typeof body.isAvailable === "boolean") data.isAvailable = body.isAvailable;
  if (body.price !== undefined) {
    if (!Number.isInteger(body.price) || body.price < 0) {
      throw new Error("price must be a non-negative integer");
    }
    data.price = body.price;
  }
  if (Object.keys(data).length === 0) throw new Error("No variant changes provided");

  return prisma.productVariant.update({ where: { id }, data });
}

async function updateOrderStatus(id, nextStatus) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new Error("Order not found");

  const status = OrderStateMachine.transition(order.status, nextStatus);
  const updated = await prisma.order.update({
    where: { id },
    data: { status },
    include: orderInclude,
  });
  return orderDto(updated);
}

async function markOrderPaid(id) {
  const updated = await prisma.order.update({
    where: { id },
    data: { paymentStatus: "PAID" },
    include: orderInclude,
  });
  return orderDto(updated);
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, jsonHeaders);
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);
  const path = url.pathname;

  try {
    if (request.method === "GET" && path === "/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "GET" && path === "/") {
      response.writeHead(302, { Location: "/customer/" });
      response.end();
      return;
    }

    if (request.method === "GET" && path.startsWith("/customer")) {
      if (serveStatic(response, customerRoot, path, "/customer")) return;
    }

    if (request.method === "GET" && path.startsWith("/kds")) {
      if (serveStatic(response, kitchenRoot, path, "/kds")) return;
    }

    if (request.method === "GET" && path.startsWith("/admin")) {
      if (serveStatic(response, adminRoot, path, "/admin")) return;
    }

    if (request.method === "POST" && path === "/api/admin/login") {
      const body = await readJson(request);
      if (!process.env.ADMIN_PIN) {
        sendError(response, 503, "ADMIN_PIN is not configured");
        return;
      }
      if (String(body.pin || "") !== process.env.ADMIN_PIN) {
        sendError(response, 401, "Invalid admin PIN");
        return;
      }
      const token = randomBytes(32).toString("hex");
      adminSessions.add(token);
      sendJson(response, 200, { token });
      return;
    }

    if (path === "/api/admin/products") {
      if (!requireAdmin(request, response)) return;
      if (request.method !== "GET") {
        sendError(response, 405, "Method not allowed");
        return;
      }
      sendJson(response, 200, await getAdminProducts());
      return;
    }

    const adminProductMatch = path.match(/^\/api\/admin\/products\/([^/]+)$/);
    if (request.method === "PATCH" && adminProductMatch) {
      if (!requireAdmin(request, response)) return;
      const body = await readJson(request);
      if (typeof body.isAvailable !== "boolean") {
        sendError(response, 400, "isAvailable must be a boolean");
        return;
      }
      sendJson(response, 200, await updateProductAvailability(adminProductMatch[1], body.isAvailable));
      return;
    }

    const adminVariantMatch = path.match(/^\/api\/admin\/variants\/([^/]+)$/);
    if (request.method === "PATCH" && adminVariantMatch) {
      if (!requireAdmin(request, response)) return;
      sendJson(response, 200, await updateVariant(adminVariantMatch[1], await readJson(request)));
      return;
    }

    if (path === "/api/admin/promotions") {
      if (!requireAdmin(request, response)) return;
      if (request.method === "GET") {
        sendJson(response, 200, await getAdminPromotions());
        return;
      }
      if (request.method === "POST") {
        sendJson(response, 201, await createPromotion(await readJson(request)));
        return;
      }
      sendError(response, 405, "Method not allowed");
      return;
    }

    const adminPromotionMatch = path.match(/^\/api\/admin\/promotions\/([^/]+)$/);
    if (request.method === "PATCH" && adminPromotionMatch) {
      if (!requireAdmin(request, response)) return;
      sendJson(response, 200, await updatePromotion(adminPromotionMatch[1], await readJson(request)));
      return;
    }

    const reportMatch = path.match(/^\/api\/admin\/reports\/(daily|monthly|export)$/);
    if (request.method === "GET" && reportMatch) {
      if (!requireAdmin(request, response)) return;
      const reportType = reportMatch[1];
      const period = reportType === "monthly" ? "monthly" : reportType === "daily" ? "daily" : url.searchParams.get("period");
      const value = period === "monthly" ? url.searchParams.get("month") : url.searchParams.get("date");
      const report = await buildReport(period, value);
      if (reportType === "export") {
        const buffer = await reportWorkbook(report);
        const filename = `${period}-${value}-report.xlsx`;
        response.writeHead(200, {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": buffer.length,
        });
        response.end(buffer);
        return;
      }
      sendJson(response, 200, report);
      return;
    }

    if (request.method === "GET" && path === "/api/products") {
      const products = await prisma.product.findMany({
        where: { name: { notIn: legacyProductNames } },
        orderBy: [{ categoryOrder: "asc" }, { displayOrder: "asc" }],
        include: { variants: true },
      });
      sendJson(response, 200, products.map(productDto));
      return;
    }

    if (request.method === "POST" && path === "/api/orders") {
      const order = await createOrder(await readJson(request));
      sendJson(response, 201, order);
      return;
    }

    const publicOrderMatch = path.match(/^\/api\/orders\/public\/([^/]+)$/);
    if (request.method === "GET" && publicOrderMatch) {
      const order = await getOrderByToken(publicOrderMatch[1]);
      if (!order) {
        sendError(response, 404, "Order not found");
        return;
      }
      sendJson(response, 200, order);
      return;
    }

    if (request.method === "GET" && path === "/api/kitchen/orders") {
      if (!requireAdmin(request, response)) return;
      sendJson(response, 200, await getKitchenOrders());
      return;
    }

    const statusMatch = path.match(/^\/api\/orders\/([^/]+)\/status$/);
    if (request.method === "PATCH" && statusMatch) {
      if (!requireAdmin(request, response)) return;
      const body = await readJson(request);
      const order = await updateOrderStatus(statusMatch[1], body.status);
      sendJson(response, 200, order);
      return;
    }

    const paymentMatch = path.match(/^\/api\/orders\/([^/]+)\/payment$/);
    if (request.method === "PATCH" && paymentMatch) {
      if (!requireAdmin(request, response)) return;
      const order = await markOrderPaid(paymentMatch[1]);
      sendJson(response, 200, order);
      return;
    }

    sendError(response, 404, "Route not found");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const statusCode = message === "Order not found" || message === "Table not found" ? 404 : 400;
    sendError(response, statusCode, message);
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`POS API listening on http://0.0.0.0:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
