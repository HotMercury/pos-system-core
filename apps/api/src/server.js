const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { OrderStateMachine } = require("@pos/domain");
const { prisma } = require("@pos/database");

const port = Number(process.env.PORT || 3000);
const customerRoot = path.resolve(__dirname, "../../customer-web/public");
const kitchenRoot = path.resolve(__dirname, "../../kds-web/public");

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
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
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
    price: product.price,
    category: product.category,
    imageUrl: product.imageUrl || undefined,
    isAvailable: product.isAvailable,
  };
}

function orderDto(order) {
  return {
    id: order.id,
    tableId: order.tableId,
    tableNumber: order.table.number,
    totalAmount: order.totalAmount,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod || undefined,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
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
  items: { include: { product: true } },
};

async function createOrder(body) {
  if (typeof body.tableNumber !== "string" || !body.tableNumber.trim()) {
    throw new Error("tableNumber is required");
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new Error("At least one order item is required");
  }

  const quantities = new Map();
  for (const item of body.items) {
    if (typeof item?.productId !== "string" || !Number.isInteger(item.quantity)) {
      throw new Error("Each item requires a productId and integer quantity");
    }
    if (item.quantity < 1 || item.quantity > 99) {
      throw new Error("Quantity must be between 1 and 99");
    }
    quantities.set(
      item.productId,
      (quantities.get(item.productId) || 0) + item.quantity
    );
  }

  return prisma.$transaction(async (transaction) => {
    const table = await transaction.table.findUnique({
      where: { number: body.tableNumber.trim() },
    });
    if (!table) throw new Error("Table not found");

    const products = await transaction.product.findMany({
      where: { id: { in: [...quantities.keys()] } },
    });
    const productsById = new Map(products.map((product) => [product.id, product]));

    const lines = [...quantities.entries()].map(([productId, quantity]) => {
      const product = productsById.get(productId);
      if (!product || !product.isAvailable) {
        throw new Error("One or more products are unavailable");
      }
      return { productId, quantity, price: product.price };
    });

    const totalAmount = lines.reduce(
      (total, line) => total + line.price * line.quantity,
      0
    );

    const order = await transaction.order.create({
      data: {
        tableId: table.id,
        totalAmount,
        paymentMethod: "CASH",
        items: { create: lines },
      },
      include: orderInclude,
    });

    return orderDto(order);
  });
}

async function getOrder(id) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: orderInclude,
  });
  return order ? orderDto(order) : null;
}

async function getKitchenOrders() {
  const orders = await prisma.order.findMany({
    where: { status: { in: ["CREATED", "PREPARING", "COMPLETED"] } },
    orderBy: { createdAt: "desc" },
    include: orderInclude,
  });
  return orders.map(orderDto);
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

    if (request.method === "GET" && path === "/api/products") {
      const products = await prisma.product.findMany({
        where: { isAvailable: true },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      });
      sendJson(response, 200, products.map(productDto));
      return;
    }

    if (request.method === "POST" && path === "/api/orders") {
      const order = await createOrder(await readJson(request));
      sendJson(response, 201, order);
      return;
    }

    const orderMatch = path.match(/^\/api\/orders\/([^/]+)$/);
    if (request.method === "GET" && orderMatch) {
      const order = await getOrder(orderMatch[1]);
      if (!order) {
        sendError(response, 404, "Order not found");
        return;
      }
      sendJson(response, 200, order);
      return;
    }

    if (request.method === "GET" && path === "/api/kitchen/orders") {
      sendJson(response, 200, await getKitchenOrders());
      return;
    }

    const statusMatch = path.match(/^\/api\/orders\/([^/]+)\/status$/);
    if (request.method === "PATCH" && statusMatch) {
      const body = await readJson(request);
      const order = await updateOrderStatus(statusMatch[1], body.status);
      sendJson(response, 200, order);
      return;
    }

    const paymentMatch = path.match(/^\/api\/orders\/([^/]+)\/payment$/);
    if (request.method === "PATCH" && paymentMatch) {
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
