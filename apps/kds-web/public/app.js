const loginPanel = document.querySelector("#login-panel");
const kdsPanel = document.querySelector("#kds-panel");
const loginForm = document.querySelector("#login-form");
const loginError = document.querySelector("#login-error");
const ordersElement = document.querySelector("#orders");
const toast = document.querySelector("#toast");
let token = sessionStorage.getItem("pos-admin-token") || "";

function money(value) {
  return `$${value.toLocaleString("zh-TW")}`;
}

function statusText(status) {
  return { CREATED: "待接單", PREPARING: "製作中", COMPLETED: "已完成" }[status] || status;
}

function orderLabel(order) {
  return order.orderType === "TAKEAWAY" ? `外帶 ${order.pickupCode}` : `桌 ${order.tableNumber}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2200);
}

function setLoggedIn(loggedIn) {
  loginPanel.classList.toggle("hidden", loggedIn);
  kdsPanel.classList.toggle("hidden", !loggedIn);
}

async function apiFetch(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  if (response.status === 401) {
    token = "";
    sessionStorage.removeItem("pos-admin-token");
    setLoggedIn(false);
    throw new Error("登入已失效");
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "操作失敗");
  return body;
}

function renderOrders(orders) {
  if (orders.length === 0) {
    ordersElement.innerHTML = `<div class="empty-state">目前沒有訂單</div>`;
    return;
  }

  ordersElement.innerHTML = orders.map((order) => {
    const nextAction = order.status === "CREATED"
      ? `<button class="action primary" data-action="PREPARING" data-id="${order.id}">接單並開始製作</button>`
      : order.status === "PREPARING"
        ? `<button class="action primary" data-action="COMPLETED" data-id="${order.id}">標記完成</button>`
        : "";
    const paymentAction = order.paymentStatus === "UNPAID"
      ? `<button class="action secondary" data-action="PAID" data-id="${order.id}">收現金</button>`
      : `<span class="paid">已收現金</span>`;

    return `
      <article class="order-card ${order.status.toLowerCase()} ${order.orderType.toLowerCase()}">
        <header class="order-header">
          <div><span class="table-number">${orderLabel(order)}</span><span class="order-time">${new Date(order.createdAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</span></div>
          <span class="status">${statusText(order.status)}</span>
        </header>
        <div class="order-lines">
          ${order.items.map((item) => `<div class="line"><span>${item.productName}${item.options ? ` <small>${item.options}</small>` : ""} × ${item.quantity}</span><strong>${money(item.price * item.quantity)}</strong></div>`).join("")}
        </div>
        <footer class="order-footer">
          <strong>合計 ${money(order.totalAmount)}</strong>
          <div class="actions">${paymentAction}${nextAction}</div>
        </footer>
      </article>
    `;
  }).join("");
}

async function loadOrders() {
  try {
    renderOrders(await apiFetch("/api/kitchen/orders"));
  } catch (error) {
    if (token) ordersElement.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: new FormData(loginForm).get("pin") }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "登入失敗");
    token = body.token;
    sessionStorage.setItem("pos-admin-token", token);
    setLoggedIn(true);
    await loadOrders();
  } catch (error) {
    loginError.textContent = error.message;
  }
});

ordersElement.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-id]");
  if (!button) return;
  button.disabled = true;
  try {
    const isPayment = button.dataset.action === "PAID";
    await apiFetch(`/api/orders/${button.dataset.id}/${isPayment ? "payment" : "status"}`, {
      method: "PATCH",
      body: isPayment ? JSON.stringify({ paid: true }) : JSON.stringify({ status: button.dataset.action }),
    });
    showToast(isPayment ? "已記錄收款" : "訂單狀態已更新");
    await loadOrders();
  } catch (error) {
    showToast(error.message);
    button.disabled = false;
  }
});

if (token) {
  setLoggedIn(true);
  loadOrders();
}

window.setInterval(() => {
  if (token) loadOrders();
}, 3000);
