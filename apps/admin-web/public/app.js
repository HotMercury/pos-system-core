const state = { token: sessionStorage.getItem("pos-admin-token") || "", products: [] };
const loginView = document.querySelector("#login-view");
const adminView = document.querySelector("#admin-view");
const loginForm = document.querySelector("#login-form");
const loginError = document.querySelector("#login-error");
const productsElement = document.querySelector("#products");
const promotionsElement = document.querySelector("#promotions");
const promotionForm = document.querySelector("#promotion-form");
const feedback = document.querySelector("#feedback");
const reportDate = document.querySelector("#report-date");
const reportMonth = document.querySelector("#report-month");
const reportSummary = document.querySelector("#report-summary");
const reportTable = document.querySelector("#report-table");
let currentReport = { period: "daily", value: "" };

function showFeedback(message, isError = false) {
  feedback.textContent = message;
  feedback.classList.toggle("error", isError);
  window.setTimeout(() => { feedback.textContent = ""; }, 2400);
}

function variantLabel(variant) {
  return [variant.temperature === "H" ? "熱" : "冰", variant.size, variant.flavor]
    .filter(Boolean)
    .join(" / ");
}

function setLoggedIn(loggedIn) {
  loginView.classList.toggle("hidden", loggedIn);
  adminView.classList.toggle("hidden", !loggedIn);
}

async function adminFetch(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}`, ...(options.headers || {}) },
  });
  if (response.status === 401) {
    state.token = "";
    sessionStorage.removeItem("pos-admin-token");
    setLoggedIn(false);
    throw new Error("登入已失效");
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "操作失敗");
  return body;
}

function renderProducts() {
  productsElement.innerHTML = state.products.map((product) => `
    <article class="product-card ${product.isAvailable ? "" : "unavailable"}">
      <header class="product-header">
        <div>
          <h2>${product.name}</h2>
          <p class="muted">${product.englishName || ""}</p>
        </div>
        <button class="availability-button ${product.isAvailable ? "on" : "off"}" data-product-id="${product.id}" data-available="${product.isAvailable}">
          ${product.isAvailable ? "販售中" : "已售罄"}
        </button>
      </header>
      <div class="variants">
        ${product.variants.map((variant) => `
          <div class="variant-row ${variant.isAvailable ? "" : "unavailable"}">
            <span>${variantLabel(variant)}</span>
            <input class="price-input" type="number" min="0" value="${variant.price}" data-variant-price="${variant.id}" />
            <button class="variant-button ${variant.isAvailable ? "on" : "off"}" data-variant-id="${variant.id}" data-available="${variant.isAvailable}">
              ${variant.isAvailable ? "可售" : "售罄"}
            </button>
            <button class="save-price" data-save-variant="${variant.id}">儲存</button>
          </div>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function renderPromotions(promotions) {
  promotionsElement.innerHTML = promotions.length === 0
    ? `<p class="muted">目前沒有優惠碼</p>`
    : promotions.map((promotion) => `
      <div class="promotion-row ${promotion.isActive ? "" : "inactive"}">
        <div><strong>${promotion.code}${promotion.isMedical ? " · 醫美" : ""}</strong><span class="muted">${promotion.discountType === "PERCENTAGE" ? `${promotion.value}% 折扣` : `折 $${promotion.value}`} · 已用 ${promotion.usedCount}${promotion.maxUses ? ` / ${promotion.maxUses}` : ""}</span></div>
        <div class="promotion-actions">
          <input type="number" min="0" value="${promotion.value}" data-promotion-value="${promotion.id}" />
          <button class="save-price" data-save-promotion="${promotion.id}">更新</button>
          <button class="variant-button ${promotion.isActive ? "on" : "off"}" data-toggle-promotion="${promotion.id}">${promotion.isActive ? "啟用中" : "已停用"}</button>
        </div>
      </div>
    `).join("");
}

async function loadProducts() {
  state.products = await adminFetch("/api/admin/products");
  renderProducts();
}

async function loadPromotions() {
  renderPromotions(await adminFetch("/api/admin/promotions"));
}

function renderReport(report) {
  reportSummary.innerHTML = [
    ["完成訂單", report.summary.orderCount],
    ["總杯數", report.summary.cups],
    ["一般客", report.summary.generalCups],
    ["醫美客", report.summary.medicalCups],
    ["實收金額", `$${report.summary.totalAmount.toLocaleString()}`],
  ].map(([label, value]) => `<div class="report-stat"><span>${label}</span><strong>${value}</strong></div>`).join("");
  reportTable.innerHTML = `
    <table><thead><tr><th>客群</th><th>品項</th><th>規格</th><th>杯數</th><th>折扣前</th></tr></thead>
    <tbody>${report.rows.map((row) => `<tr><td>${row.customerSegment === "MEDICAL" ? "醫美" : "一般"}</td><td>${row.productName}</td><td>${row.temperature}${row.size}${row.flavor ? ` / ${row.flavor}` : ""}</td><td>${row.quantity}</td><td>$${row.grossAmount.toLocaleString()}</td></tr>`).join("")}</tbody>
    </table>`;
}

async function loadReport(period, value) {
  currentReport = { period, value };
  const path = period === "daily" ? `/api/admin/reports/daily?date=${value}` : `/api/admin/reports/monthly?month=${value}`;
  renderReport(await adminFetch(path));
}

async function downloadReport() {
  const query = currentReport.period === "daily" ? `period=daily&date=${currentReport.value}` : `period=monthly&month=${currentReport.value}`;
  const response = await fetch(`/api/admin/reports/export?${query}`, { headers: { Authorization: `Bearer ${state.token}` } });
  if (!response.ok) throw new Error("報表下載失敗");
  const blob = await response.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${currentReport.period}-${currentReport.value}-report.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
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
    state.token = body.token;
    sessionStorage.setItem("pos-admin-token", state.token);
    setLoggedIn(true);
    await Promise.all([loadProducts(), loadPromotions()]);
  } catch (error) {
    loginError.textContent = error.message;
  }
});

productsElement.addEventListener("click", async (event) => {
  const productButton = event.target.closest("[data-product-id]");
  const variantButton = event.target.closest("[data-variant-id]");
  const saveButton = event.target.closest("[data-save-variant]");
  try {
    if (productButton) {
      await adminFetch(`/api/admin/products/${productButton.dataset.productId}`, {
        method: "PATCH",
        body: JSON.stringify({ isAvailable: productButton.dataset.available !== "true" }),
      });
      await loadProducts();
      showFeedback("商品販售狀態已更新");
      return;
    }
    if (variantButton) {
      await adminFetch(`/api/admin/variants/${variantButton.dataset.variantId}`, {
        method: "PATCH",
        body: JSON.stringify({ isAvailable: variantButton.dataset.available !== "true" }),
      });
      await loadProducts();
      showFeedback("規格販售狀態已更新");
      return;
    }
    if (saveButton) {
      const input = document.querySelector(`[data-variant-price="${saveButton.dataset.saveVariant}"]`);
      await adminFetch(`/api/admin/variants/${saveButton.dataset.saveVariant}`, {
        method: "PATCH",
        body: JSON.stringify({ price: Number(input.value) }),
      });
      await loadProducts();
      showFeedback("價格已更新");
      return;
    }
  } catch (error) {
    showFeedback(error.message, true);
  }
});

promotionsElement.addEventListener("click", async (event) => {
  const savePromotion = event.target.closest("[data-save-promotion]");
  const togglePromotion = event.target.closest("[data-toggle-promotion]");
  if (!savePromotion && !togglePromotion) return;
  try {
    const id = (savePromotion || togglePromotion).dataset.savePromotion || (savePromotion || togglePromotion).dataset.togglePromotion;
    const promotion = (await adminFetch("/api/admin/promotions")).find((item) => item.id === id);
    const valueInput = document.querySelector(`[data-promotion-value="${id}"]`);
    await adminFetch(`/api/admin/promotions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        code: promotion.code,
          discountType: promotion.discountType,
          value: savePromotion ? Number(valueInput.value) : promotion.value,
          isMedical: promotion.isMedical,
        minAmount: promotion.minAmount,
        maxUses: promotion.maxUses,
        isActive: togglePromotion ? !promotion.isActive : promotion.isActive,
        startsAt: promotion.startsAt,
        endsAt: promotion.endsAt,
      }),
    });
    await loadPromotions();
    showFeedback("優惠碼已更新");
  } catch (error) {
    showFeedback(error.message, true);
  }
});

promotionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const form = new FormData(promotionForm);
    await adminFetch("/api/admin/promotions", {
      method: "POST",
      body: JSON.stringify({
        code: form.get("code"),
        discountType: form.get("discountType"),
        value: Number(form.get("value")),
        isMedical: form.get("isMedical") === "on",
        minAmount: form.get("minAmount") || 0,
        maxUses: form.get("maxUses") || null,
      }),
    });
    promotionForm.reset();
    await loadPromotions();
    showFeedback("優惠碼已新增");
  } catch (error) {
    showFeedback(error.message, true);
  }
});

document.querySelector("#daily-report").addEventListener("click", async () => {
  try {
    await loadReport("daily", reportDate.value);
  } catch (error) {
    showFeedback(error.message, true);
  }
});

document.querySelector("#monthly-report").addEventListener("click", async () => {
  try {
    await loadReport("monthly", reportMonth.value);
  } catch (error) {
    showFeedback(error.message, true);
  }
});

document.querySelector("#download-report").addEventListener("click", async () => {
  try {
    await downloadReport();
  } catch (error) {
    showFeedback(error.message, true);
  }
});

document.querySelector("#logout").addEventListener("click", () => {
  state.token = "";
  sessionStorage.removeItem("pos-admin-token");
  setLoggedIn(false);
});

if (state.token) {
  setLoggedIn(true);
  Promise.all([loadProducts(), loadPromotions()]).catch((error) => showFeedback(error.message, true));
}

const today = new Date();
reportDate.value = today.toISOString().slice(0, 10);
reportMonth.value = today.toISOString().slice(0, 7);
