const params = new URLSearchParams(window.location.search);
const tableNumber = params.get("table");
const initialOrderType = params.get("takeaway") === "1" || !tableNumber ? "TAKEAWAY" : "DINE_IN";
const state = { products: [], cart: new Map(), orders: [], orderType: initialOrderType };

const menuElement = document.querySelector("#menu");
const tableLabel = document.querySelector("#table-label");
const cartPanel = document.querySelector("#cart-panel");
const cartItems = document.querySelector("#cart-items");
const cartCount = document.querySelector("#cart-count");
const cartTotal = document.querySelector("#cart-total");
const promoCodeInput = document.querySelector("#promo-code");
const orderPanel = document.querySelector("#order-panel");
const orderList = document.querySelector("#order-list");
const variantModal = document.querySelector("#variant-modal");
const variantTitle = document.querySelector("#variant-title");
const variantDescription = document.querySelector("#variant-description");
const variantOptions = document.querySelector("#variant-options");
const toast = document.querySelector("#toast");

function money(value) {
  return `$${value.toLocaleString("zh-TW")}`;
}

function temperatureText(temperature) {
  return temperature === "H" ? "熱" : "冰";
}

function variantText(variant) {
  return [temperatureText(variant.temperature), variant.size, variant.flavor]
    .filter(Boolean)
    .join(" / ");
}

function statusText(status) {
  return { CREATED: "已送出，等待廚房接單", PREPARING: "廚房製作中", COMPLETED: "餐點完成", CANCELLED: "訂單已取消" }[status] || status;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2400);
}

function storageKey() {
  return `pos:orders:${state.orderType}:${tableNumber || "takeaway"}`;
}

function savedOrderIds() {
  try {
    return JSON.parse(localStorage.getItem(storageKey()) || "[]");
  } catch {
    return [];
  }
}

function saveOrderIds() {
  localStorage.setItem(storageKey(), JSON.stringify(state.orders.map((order) => order.id).slice(0, 20)));
}

function updateOrderMode() {
  tableLabel.textContent = state.orderType === "DINE_IN" ? `桌位 ${tableNumber}` : "外帶取餐";
  document.querySelectorAll("[data-order-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.orderType === state.orderType);
  });
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
          <article class="product-card" data-product-id="${product.id}">
            ${product.imageUrl
              ? `<img src="${product.imageUrl}" alt="${product.name}" />`
              : `<div class="image-placeholder text-placeholder"><strong>${product.name}</strong><span>${product.englishName || "Coffee selection"}</span></div>`}
            <div class="product-info">
              <h3>${product.name}</h3>
              ${product.englishName ? `<p class="english-name">${product.englishName}</p>` : ""}
              ${product.description ? `<p class="description">${product.description}</p>` : ""}
              <p class="variant-summary">${variantSummary(product.variants)}</p>
              <button class="choose-button" data-product-id="${product.id}">選擇規格</button>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `).join("");
}

function variantSummary(variants) {
  const temperatures = [...new Set(variants.map((variant) => temperatureText(variant.temperature)))];
  const sizes = [...new Set(variants.map((variant) => variant.size))];
  return `${temperatures.join(" / ")} · ${sizes.join(" / ")}`;
}

function openVariantModal(product) {
  variantTitle.textContent = product.name;
  variantDescription.textContent = product.description || "請選擇尺寸與溫度";
  variantOptions.innerHTML = product.variants.map((variant) => `
    <button class="variant-button modal-option" data-variant-id="${variant.id}">
      <span>${variantText(variant)}</span>
      <strong>${money(variant.price)}</strong>
    </button>
  `).join("");
  variantModal.classList.remove("hidden");
  variantModal.setAttribute("aria-hidden", "false");
}

function closeVariantModal() {
  variantModal.classList.add("hidden");
  variantModal.setAttribute("aria-hidden", "true");
}

function renderCart() {
  const entries = [...state.cart.values()];
  cartPanel.classList.toggle("hidden", entries.length === 0);
  const count = entries.reduce((sum, item) => sum + item.quantity, 0);
  const total = entries.reduce((sum, item) => sum + item.variant.price * item.quantity, 0);
  cartCount.textContent = count;
  cartTotal.textContent = money(total);
  cartItems.innerHTML = entries.map(({ product, variant, quantity }) => `
    <div class="cart-row">
      <div><strong>${product.name}</strong><span class="muted">${variantText(variant)} · ${money(variant.price)}</span></div>
      <div class="quantity-controls">
        <button data-action="decrease" data-variant-id="${variant.id}">−</button>
        <span>${quantity}</span>
        <button data-action="increase" data-variant-id="${variant.id}">+</button>
      </div>
    </div>
  `).join("");
}

function orderHeading(order) {
  return order.orderType === "TAKEAWAY" ? `外帶取餐 ${order.pickupCode}` : `桌位 ${order.tableNumber}`;
}

function renderOrders() {
  orderPanel.classList.toggle("hidden", state.orders.length === 0);
  orderList.innerHTML = state.orders.map((order) => `
    <article class="saved-order">
      <div class="saved-order-heading">
        <div><strong>${orderHeading(order)}</strong><span class="muted">訂單 ${order.id.slice(0, 8)}</span></div>
        <span class="order-status-label">${statusText(order.status)}</span>
      </div>
      <div class="saved-order-items">
        ${order.items.map((item) => `<div class="summary-row"><span>${item.productName} ${item.options ? `· ${item.options}` : ""} × ${item.quantity}</span><strong>${money(item.price * item.quantity)}</strong></div>`).join("")}
      </div>
      ${order.discountAmount > 0 ? `<div class="summary-row discount-row"><span>優惠 ${order.promotionCode || ""}</span><strong>-${money(order.discountAmount)}</strong></div>` : ""}
      <div class="summary-total"><span>合計</span><strong>${money(order.totalAmount)}</strong></div>
      <p class="muted payment-line">付款：${order.paymentStatus === "PAID" ? "已收現金" : "現金，待收款"}</p>
    </article>
  `).join("");
}

async function loadOrders() {
  let orders = [];
  if (state.orderType === "DINE_IN") {
    const response = await fetch(`/api/orders?tableNumber=${encodeURIComponent(tableNumber)}`);
    if (!response.ok) throw new Error("無法載入桌位訂單");
    orders = await response.json();
  } else {
    const ids = savedOrderIds();
    orders = (await Promise.all(ids.map(async (id) => {
      const response = await fetch(`/api/orders/${id}`);
      return response.ok ? response.json() : null;
    }))).filter(Boolean);
  }
  state.orders = orders;
  saveOrderIds();
  renderOrders();
}

async function refreshOrders() {
  try {
    await loadOrders();
  } catch {
    // Keep the last visible order state during a temporary network failure.
  }
}

function startNewOrder() {
  state.cart.clear();
  renderCart();
  window.scrollTo({ top: 0, behavior: "smooth" });
  showToast("可以開始新的訂單");
}

document.querySelectorAll("[data-order-type]").forEach((button) => {
  button.addEventListener("click", async () => {
    if (state.cart.size > 0) {
      showToast("請先完成或清空目前購物車");
      return;
    }
    if (button.dataset.orderType === "DINE_IN" && !tableNumber) {
      showToast("內用需要桌號 QR Code");
      return;
    }
    state.orderType = button.dataset.orderType;
    updateOrderMode();
    await refreshOrders();
  });
});

menuElement.addEventListener("click", (event) => {
  const button = event.target.closest("[data-product-id]");
  if (!button) return;
  const product = state.products.find((item) => item.id === button.dataset.productId);
  openVariantModal(product);
});

variantOptions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-variant-id]");
  if (!button) return;
  const variantId = button.dataset.variantId;
  const product = state.products.find((item) => item.variants.some((variant) => variant.id === variantId));
  const variant = product.variants.find((item) => item.id === variantId);
  const current = state.cart.get(variant.id);
  state.cart.set(variant.id, { product, variant, quantity: (current?.quantity || 0) + 1 });
  closeVariantModal();
  renderCart();
  showToast(`${product.name} ${variantText(variant)} 已加入`);
});

variantModal.addEventListener("click", (event) => {
  if (event.target.matches("[data-close-modal]")) closeVariantModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeVariantModal();
});

cartItems.addEventListener("click", (event) => {
  const button = event.target.closest("[data-variant-id]");
  if (!button) return;
  const item = state.cart.get(button.dataset.variantId);
  const next = button.dataset.action === "increase" ? item.quantity + 1 : item.quantity - 1;
  if (next <= 0) state.cart.delete(button.dataset.variantId);
  else state.cart.set(button.dataset.variantId, { ...item, quantity: next });
  renderCart();
});

document.querySelector("#new-order").addEventListener("click", startNewOrder);

document.querySelector("#submit-order").addEventListener("click", async () => {
  const button = document.querySelector("#submit-order");
  button.disabled = true;
  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderType: state.orderType,
        ...(state.orderType === "DINE_IN" ? { tableNumber } : {}),
        ...(promoCodeInput.value.trim() ? { promoCode: promoCodeInput.value.trim() } : {}),
        items: [...state.cart.values()].map(({ variant, quantity }) => ({ variantId: variant.id, quantity })),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "送單失敗");
    state.orders = [result, ...state.orders.filter((order) => order.id !== result.id)].slice(0, 20);
    saveOrderIds();
    state.cart.clear();
    promoCodeInput.value = "";
    renderCart();
    renderOrders();
    showToast(state.orderType === "TAKEAWAY" ? `訂單已送出，取餐號碼 ${result.pickupCode}` : "訂單已送出");
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
  }
});

updateOrderMode();
loadProducts()
  .then(loadOrders)
  .catch((error) => {
    menuElement.innerHTML = `<div class="empty-state">${error.message}</div>`;
  });

window.setInterval(refreshOrders, 5000);
