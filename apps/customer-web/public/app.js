const params = new URLSearchParams(window.location.search);
const tableNumber = params.get("table") || "A1";
const state = { products: [], cart: new Map(), order: null };

const menuElement = document.querySelector("#menu");
const tableLabel = document.querySelector("#table-label");
const cartPanel = document.querySelector("#cart-panel");
const cartItems = document.querySelector("#cart-items");
const cartCount = document.querySelector("#cart-count");
const cartTotal = document.querySelector("#cart-total");
const orderPanel = document.querySelector("#order-panel");
const orderStatus = document.querySelector("#order-status");
const orderSummary = document.querySelector("#order-summary");
const toast = document.querySelector("#toast");

tableLabel.textContent = `桌位 ${tableNumber}`;

function money(value) {
  return `$${value.toLocaleString("zh-TW")}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2400);
}

async function loadProducts() {
  const response = await fetch("/api/products");
  if (!response.ok) throw new Error("無法載入菜單");
  state.products = await response.json();
  renderMenu();
}

function renderMenu() {
  const groups = new Map();
  for (const product of state.products) {
    if (!groups.has(product.category)) groups.set(product.category, []);
    groups.get(product.category).push(product);
  }

  menuElement.innerHTML = [...groups.entries()].map(([category, products]) => `
    <section class="menu-group">
      <div class="section-heading"><h2>${category}</h2><span class="muted">${products.length} 項</span></div>
      <div class="product-grid">
        ${products.map((product) => `
          <article class="product-card">
            ${product.imageUrl ? `<img src="${product.imageUrl}" alt="${product.name}" />` : `<div class="image-placeholder">${product.name.slice(0, 1)}</div>`}
            <div class="product-info">
              <h3>${product.name}</h3>
              <strong>${money(product.price)}</strong>
              <button class="add-button" data-product-id="${product.id}">加入</button>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `).join("");
}

function renderCart() {
  const entries = [...state.cart.values()];
  cartPanel.classList.toggle("hidden", entries.length === 0 || state.order !== null);
  const count = entries.reduce((sum, item) => sum + item.quantity, 0);
  const total = entries.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  cartCount.textContent = count;
  cartTotal.textContent = money(total);
  cartItems.innerHTML = entries.map(({ product, quantity }) => `
    <div class="cart-row">
      <div><strong>${product.name}</strong><span class="muted">${money(product.price)}</span></div>
      <div class="quantity-controls">
        <button data-action="decrease" data-product-id="${product.id}">−</button>
        <span>${quantity}</span>
        <button data-action="increase" data-product-id="${product.id}">+</button>
      </div>
    </div>
  `).join("");
}

function statusText(status) {
  return { CREATED: "已送出，等待廚房接單", PREPARING: "廚房製作中", COMPLETED: "餐點完成", CANCELLED: "訂單已取消" }[status] || status;
}

function renderOrder(order) {
  orderPanel.classList.remove("hidden");
  orderStatus.innerHTML = `<strong>${statusText(order.status)}</strong><span>付款：${order.paymentStatus === "PAID" ? "已收現金" : "現金，待收款"}</span>`;
  orderSummary.innerHTML = order.items.map((item) => `<div class="summary-row"><span>${item.productName} × ${item.quantity}</span><strong>${money(item.price * item.quantity)}</strong></div>`).join("") + `<div class="summary-total"><span>合計</span><strong>${money(order.totalAmount)}</strong></div>`;
  document.querySelector("#order-id").textContent = `訂單 ${order.id.slice(0, 8)}`;
}

async function refreshOrder() {
  if (!state.order) return;
  const response = await fetch(`/api/orders/${state.order.id}`);
  if (response.ok) {
    state.order = await response.json();
    renderOrder(state.order);
  }
}

menuElement.addEventListener("click", (event) => {
  const button = event.target.closest("[data-product-id]");
  if (!button) return;
  const product = state.products.find((item) => item.id === button.dataset.productId);
  const current = state.cart.get(product.id);
  state.cart.set(product.id, { product, quantity: (current?.quantity || 0) + 1 });
  renderCart();
  showToast(`${product.name} 已加入`);
});

cartItems.addEventListener("click", (event) => {
  const button = event.target.closest("[data-product-id]");
  if (!button) return;
  const item = state.cart.get(button.dataset.productId);
  const next = button.dataset.action === "increase" ? item.quantity + 1 : item.quantity - 1;
  if (next <= 0) state.cart.delete(button.dataset.productId);
  else state.cart.set(button.dataset.productId, { ...item, quantity: next });
  renderCart();
});

document.querySelector("#submit-order").addEventListener("click", async () => {
  const button = document.querySelector("#submit-order");
  button.disabled = true;
  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableNumber, items: [...state.cart.values()].map(({ product, quantity }) => ({ productId: product.id, quantity })) }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "送單失敗");
    state.order = result;
    renderCart();
    renderOrder(result);
    showToast("訂單已送出");
  } catch (error) {
    showToast(error.message);
    button.disabled = false;
  }
});

loadProducts().catch((error) => {
  menuElement.innerHTML = `<div class="empty-state">${error.message}</div>`;
});

window.setInterval(refreshOrder, 5000);
