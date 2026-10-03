const ordersElement = document.querySelector("#orders");
const toast = document.querySelector("#toast");

function money(value) {
  return `$${value.toLocaleString("zh-TW")}`;
}

function statusText(status) {
  return { CREATED: "待接單", PREPARING: "製作中", COMPLETED: "已完成" }[status] || status;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2200);
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
      <article class="order-card ${order.status.toLowerCase()}">
        <header class="order-header">
          <div><span class="table-number">${order.tableNumber}</span><span class="order-time">${new Date(order.createdAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</span></div>
          <span class="status">${statusText(order.status)}</span>
        </header>
        <div class="order-lines">
          ${order.items.map((item) => `<div class="line"><span>${item.productName} × ${item.quantity}</span><strong>${money(item.price * item.quantity)}</strong></div>`).join("")}
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
    const response = await fetch("/api/kitchen/orders");
    if (!response.ok) throw new Error("無法取得訂單");
    renderOrders(await response.json());
  } catch (error) {
    ordersElement.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
}

ordersElement.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-id]");
  if (!button) return;
  button.disabled = true;
  try {
    const isPayment = button.dataset.action === "PAID";
    const response = await fetch(`/api/orders/${button.dataset.id}/${isPayment ? "payment" : "status"}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: isPayment ? JSON.stringify({ paid: true }) : JSON.stringify({ status: button.dataset.action }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "更新失敗");
    showToast(isPayment ? "已記錄收款" : "訂單狀態已更新");
    await loadOrders();
  } catch (error) {
    showToast(error.message);
    button.disabled = false;
  }
});

loadOrders();
window.setInterval(loadOrders, 3000);
