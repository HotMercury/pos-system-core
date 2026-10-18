const state = { token: sessionStorage.getItem("pos-admin-token") || "", products: [] };
const loginView = document.querySelector("#login-view");
const adminView = document.querySelector("#admin-view");
const loginForm = document.querySelector("#login-form");
const loginError = document.querySelector("#login-error");
const productsElement = document.querySelector("#products");
const feedback = document.querySelector("#feedback");

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

async function loadProducts() {
  state.products = await adminFetch("/api/admin/products");
  renderProducts();
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
    await loadProducts();
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
    }
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
  loadProducts().catch((error) => showFeedback(error.message, true));
}
