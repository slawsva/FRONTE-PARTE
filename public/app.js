const state = {
  products: [],
  archive: [],
  user: null,
  admin: null,
  cart: [],
  orders: [],
  actions: [],
  productFilter: "all"
};

const USER_TOKEN_KEY = "fronte-parte-user-token";
const ADMIN_TOKEN_KEY = "fronte-parte-admin-token";

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

function money(value) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function dateTime(value) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function token(role = "user") {
  return localStorage.getItem(role === "admin" ? ADMIN_TOKEN_KEY : USER_TOKEN_KEY);
}

async function api(path, options = {}, role = "user") {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  const currentToken = token(role);
  if (currentToken) {
    headers.Authorization = `Bearer ${currentToken}`;
  }
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Ошибка запроса");
  }
  return data;
}

function toast(message) {
  const node = $("[data-toast]");
  node.textContent = message;
  node.classList.add("is-visible");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => node.classList.remove("is-visible"), 3200);
}

function setView(view) {
  const next = view || "home";
  $$("[data-view-panel]").forEach(panel => {
    panel.classList.toggle("is-hidden", panel.dataset.viewPanel !== next);
  });
  updateNavState(next);
  const nav = $("[data-primary-nav]");
  if (nav) nav.classList.remove("is-open");
  if (next === "admin") refreshAdmin().catch(() => {});
  window.scrollTo({ top: 0, behavior: "instant" });
}

function routeFromHash() {
  const route = window.location.hash.replace("#", "") || "home";
  setView(["home", "shop", "archive", "contact", "admin"].includes(route) ? route : "home");
}

function productById(id) {
  return state.products.find(product => product.id === id);
}

function cartTotal() {
  return state.cart.reduce((sum, item) => {
    const product = productById(item.productId);
    return sum + (product ? Number(product.price || 0) * Number(item.quantity || 1) : 0);
  }, 0);
}

function updateNavState(view = window.location.hash.replace("#", "") || "home") {
  $$("[data-nav]").forEach(link => {
    link.classList.toggle("is-active", link.dataset.nav === view);
  });
  $$("[data-top-filter]").forEach(link => {
    link.classList.toggle("is-active", view === "shop" && link.dataset.topFilter === state.productFilter);
  });
  $$("[data-filter]").forEach(button => {
    button.classList.toggle("is-active", button.dataset.filter === state.productFilter);
  });
}

function setProductFilter(filter) {
  state.productFilter = filter || "all";
  updateNavState("shop");
  renderProducts();
}

function renderProducts() {
  const container = $("[data-products]");
  if (!container) return;
  const products = state.productFilter === "all"
    ? state.products
    : state.products.filter(product => product.category === state.productFilter);

  container.innerHTML = products.map(product => `
    <article class="product-card">
      <div class="product-image">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)}">
      </div>
      <div class="product-info">
        <div class="product-meta">
          <span>${escapeHtml(product.edition || "Made to order")}</span>
          <strong>${money(product.price)}</strong>
        </div>
        <h3>${escapeHtml(product.title)}</h3>
        <p class="product-copy">${escapeHtml(product.description || "")}</p>
        <div class="product-meta">
          <span>${escapeHtml(product.material || "Handmade knitwear")}</span>
          <span>${escapeHtml(product.status || "available")}</span>
        </div>
        <div class="product-controls">
          <input class="size-input" data-size="${escapeHtml(product.id)}" placeholder="Размер">
          <input data-note="${escapeHtml(product.id)}" placeholder="Пожелание">
        </div>
        <button class="solid-button" type="button" data-add-to-cart="${escapeHtml(product.id)}">Добавить в корзину</button>
      </div>
    </article>
  `).join("");
  updateNavState(window.location.hash.replace("#", "") || "home");
}

function renderArchive() {
  const container = $("[data-archive]");
  if (!container) return;
  container.innerHTML = state.archive.map(item => `
    <article class="archive-card">
      <figure>
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}">
      </figure>
      <div class="archive-body">
        <div class="product-meta">
          <span>${escapeHtml(item.year || "")}</span>
          <span>${escapeHtml(item.technique || "")}</span>
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description || "")}</p>
      </div>
    </article>
  `).join("");
}

function renderCart() {
  const count = state.cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  $("[data-cart-count]").textContent = String(count);
  const container = $("[data-cart-items]");
  if (!container) return;
  if (!state.user) {
    container.innerHTML = `<p class="cart-empty">Войдите в аккаунт, чтобы корзина сохранялась и была видна с другого устройства.</p>`;
    return;
  }
  if (!state.cart.length) {
    container.innerHTML = `<p class="cart-empty">Корзина пока пустая.</p>`;
    return;
  }
  container.innerHTML = `
    ${state.cart.map(item => {
      const product = productById(item.productId);
      if (!product) return "";
      return `
        <article class="cart-line">
          <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)}">
          <div>
            <h3>${escapeHtml(product.title)}</h3>
            <p>${money(product.price)} · ${escapeHtml(item.size || "размер уточнить")}</p>
            ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ""}
            <div class="qty-row">
              <div>
                <button type="button" data-qty="${escapeHtml(item.id)}" data-next="${Math.max(1, Number(item.quantity || 1) - 1)}">−</button>
                <strong>${Number(item.quantity || 1)}</strong>
                <button type="button" data-qty="${escapeHtml(item.id)}" data-next="${Number(item.quantity || 1) + 1}">+</button>
              </div>
              <button type="button" data-remove-cart="${escapeHtml(item.id)}">Удалить</button>
            </div>
          </div>
        </article>
      `;
    }).join("")}
    <div class="order-card">
      <div class="order-meta">
        <span>Итого</span>
        <strong>${money(cartTotal())}</strong>
      </div>
      <p>Финальная цена подтверждается ателье после замеров и выбора пряжи.</p>
    </div>
  `;
}

function renderAccount() {
  const signedOut = $("[data-account-signed-out]");
  const signedIn = $("[data-account-signed-in]");
  const adminAccount = $("[data-account-admin]");
  signedOut.classList.toggle("is-hidden", Boolean(state.user || state.admin));
  signedIn.classList.toggle("is-hidden", !state.user || Boolean(state.admin));
  adminAccount.classList.toggle("is-hidden", !state.admin);
  if (state.admin) return;
  if (!state.user) return;

  $("[data-client-email]").textContent = state.user.email;
  $("[data-client-name]").textContent = state.user.name;
  const accountCart = $("[data-account-cart]");
  accountCart.innerHTML = state.cart.length
    ? state.cart.map(item => {
      const product = productById(item.productId);
      return product ? `
        <article class="mini-line">
          <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)}">
          <div>
            <h4>${escapeHtml(product.title)}</h4>
            <p>${Number(item.quantity || 1)} шт. · ${money(product.price)}</p>
          </div>
        </article>
      ` : "";
    }).join("")
    : `<p class="account-empty">Корзина пустая.</p>`;

  const orders = $("[data-account-orders]");
  orders.innerHTML = state.orders.length
    ? state.orders.map(order => `
      <article class="order-card">
        <div class="order-meta">
          <span>${escapeHtml(order.number)}</span>
          <strong>${money(order.total)}</strong>
        </div>
        <h4>${escapeHtml(order.status)}</h4>
        <p>${dateTime(order.createdAt)} · ${order.items.length} поз.</p>
      </article>
    `).join("")
    : `<p class="account-empty">Прошлых заказов пока нет.</p>`;
}

function renderAdminProducts() {
  const list = $("[data-admin-products]");
  const count = $("[data-admin-product-count]");
  if (!list || !count) return;
  count.textContent = String(state.products.length);
  list.innerHTML = state.products.map(product => `
    <article class="admin-item">
      <h4>${escapeHtml(product.title)}</h4>
      <p>${money(product.price)} · ${escapeHtml(product.category)} · ${escapeHtml(product.edition || "")}</p>
      <div class="admin-item-actions">
        <button class="small-button" type="button" data-edit-product="${escapeHtml(product.id)}">Редактировать</button>
        <button class="small-button danger" type="button" data-delete-product="${escapeHtml(product.id)}">Удалить</button>
      </div>
    </article>
  `).join("");
}

function renderAdminActions() {
  const list = $("[data-admin-actions]");
  const count = $("[data-admin-action-count]");
  if (!list || !count) return;
  count.textContent = String(state.actions.length);
  list.innerHTML = state.actions.map(action => `
    <article class="action-item">
      <div class="order-meta">
        <span>${escapeHtml(action.actor)}</span>
        <span>${dateTime(action.createdAt)}</span>
      </div>
      <p>${escapeHtml(action.message)}</p>
    </article>
  `).join("");
}

function renderAdminState() {
  const locked = $("[data-admin-locked]");
  const dashboard = $("[data-admin-dashboard]");
  locked.classList.toggle("is-hidden", Boolean(state.admin));
  dashboard.classList.toggle("is-hidden", !state.admin);
  renderAdminProducts();
  renderAdminActions();
}

function renderAll() {
  renderProducts();
  renderArchive();
  renderCart();
  renderAccount();
  renderAdminState();
}

function openCart() {
  const drawer = $("[data-cart-drawer]");
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
}

function closeCart() {
  const drawer = $("[data-cart-drawer]");
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
}

function openAccount() {
  const modal = $("[data-account-modal]");
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}

function closeAccount() {
  const modal = $("[data-account-modal]");
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

function openMenu() {
  const drawer = $("[data-menu-drawer]");
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
}

function closeMenu() {
  const drawer = $("[data-menu-drawer]");
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
}

function openSearch() {
  closeMenu();
  const modal = $("[data-search-modal]");
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  renderSearchResults($("[data-search-input]").value);
  window.setTimeout(() => $("[data-search-input]").focus(), 30);
}

function closeSearch() {
  const modal = $("[data-search-modal]");
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

function searchText(value) {
  return String(value || "").toLowerCase().trim();
}

function renderSearchResults(query) {
  const container = $("[data-search-results]");
  if (!container) return;
  const q = searchText(query);
  if (!q) {
    container.innerHTML = `
      <div class="search-empty">
        <span>Popular searches</span>
        <button type="button" data-search-suggestion="cashmere">cashmere</button>
        <button type="button" data-search-suggestion="bespoke">bespoke</button>
        <button type="button" data-search-suggestion="archive">archive</button>
      </div>
    `;
    return;
  }

  const products = state.products
    .filter(product => [
      product.title,
      product.category,
      product.material,
      product.edition,
      product.description
    ].some(value => searchText(value).includes(q)))
    .map(product => ({ type: "product", item: product }));

  const archive = state.archive
    .filter(item => [
      item.title,
      item.year,
      item.technique,
      item.description
    ].some(value => searchText(value).includes(q)))
    .map(item => ({ type: "archive", item }));

  const results = [...products, ...archive];
  if (!results.length) {
    container.innerHTML = `<p class="search-no-results">Ничего не найдено. Попробуйте cashmere, bespoke, cardigan или archive.</p>`;
    return;
  }

  container.innerHTML = results.map(result => {
    const item = result.item;
    const image = item.image || "/assets/knitwear-hero.png";
    const title = item.title;
    const meta = result.type === "product"
      ? `${item.category || "product"} · ${money(item.price)}`
      : `${item.year || "archive"} · ${item.technique || "handmade"}`;
    const body = item.description || item.material || "";
    const attr = result.type === "product" ? "data-search-product" : "data-search-archive";
    return `
      <button class="search-result" type="button" ${attr}="${escapeHtml(item.id)}">
        <img src="${escapeHtml(image)}" alt="">
        <span>
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(meta)}</small>
          <em>${escapeHtml(body)}</em>
        </span>
      </button>
    `;
  }).join("");
}

async function refreshShop() {
  const [productsData, archiveData] = await Promise.all([
    api("/api/products", {}, "public"),
    api("/api/archive", {}, "public")
  ]);
  state.products = productsData.products || [];
  state.archive = archiveData.archive || [];
}

async function refreshMe() {
  if (!token("user")) return;
  try {
    const data = await api("/api/me");
    state.user = data.user;
    state.cart = data.cart || [];
    state.orders = data.orders || [];
  } catch (error) {
    localStorage.removeItem(USER_TOKEN_KEY);
    state.user = null;
    state.cart = [];
    state.orders = [];
  }
}

async function refreshAdmin() {
  if (!token("admin")) {
    state.admin = null;
    renderAdminState();
    return;
  }
  try {
    const [me, actions] = await Promise.all([
      api("/api/admin/me", {}, "admin"),
      api("/api/admin/actions", {}, "admin")
    ]);
    state.admin = me.admin;
    state.actions = actions.actions || [];
  } catch (error) {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    state.admin = null;
    state.actions = [];
  }
  renderAdminState();
}

async function fileToDataUrl(file) {
  if (!file) return "";
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function productPayload(form) {
  const formData = new FormData(form);
  const uploaded = await fileToDataUrl(form.photo.files[0]);
  const image = uploaded || String(formData.get("image") || "").trim() || "/assets/knitwear-hero.png";
  return {
    title: formData.get("title"),
    category: formData.get("category"),
    price: Number(formData.get("price")),
    material: formData.get("material"),
    edition: formData.get("edition"),
    description: formData.get("description"),
    image,
    images: [image]
  };
}

async function archivePayload(form) {
  const formData = new FormData(form);
  const uploaded = await fileToDataUrl(form.photo.files[0]);
  return {
    title: formData.get("title"),
    year: formData.get("year"),
    technique: formData.get("technique"),
    image: uploaded || String(formData.get("image") || "").trim() || "/assets/knitwear-hero.png",
    description: formData.get("description")
  };
}

function resetProductForm() {
  const form = $("[data-product-form]");
  form.reset();
  form.elements.id.value = "";
  $("[data-product-form-title]").textContent = "Новый товар";
}

function resetArchiveForm() {
  const form = $("[data-archive-form]");
  form.reset();
  form.elements.id.value = "";
  $("[data-archive-form-title]").textContent = "Новая архивная работа";
}

function fillProductForm(product) {
  const form = $("[data-product-form]");
  form.elements.id.value = product.id;
  form.title.value = product.title || "";
  form.category.value = product.category || "bespoke";
  form.price.value = product.price || "";
  form.material.value = product.material || "";
  form.edition.value = product.edition || "";
  form.description.value = product.description || "";
  form.image.value = product.image || "";
  $("[data-product-form-title]").textContent = "Редактировать товар";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function fillArchiveForm(item) {
  const form = $("[data-archive-form]");
  form.elements.id.value = item.id;
  form.title.value = item.title || "";
  form.year.value = item.year || "";
  form.technique.value = item.technique || "";
  form.image.value = item.image || "";
  form.description.value = item.description || "";
  $("[data-archive-form-title]").textContent = "Редактировать архив";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function bindEvents() {
  window.addEventListener("hashchange", routeFromHash);
  window.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeMenu();
      closeSearch();
      closeCart();
      closeAccount();
    }
  });
  $("[data-toggle-menu]").addEventListener("click", openMenu);
  $("[data-close-menu]").addEventListener("click", closeMenu);
  $$("[data-open-cart]").forEach(button => button.addEventListener("click", () => {
    closeMenu();
    openCart();
  }));
  $("[data-close-cart]").addEventListener("click", closeCart);
  $$("[data-open-account]").forEach(button => button.addEventListener("click", () => {
    closeMenu();
    openAccount();
  }));
  $("[data-close-account]").addEventListener("click", closeAccount);
  $$("[data-open-search]").forEach(button => button.addEventListener("click", openSearch));
  $("[data-close-search]").addEventListener("click", closeSearch);
  $("[data-search-input]").addEventListener("input", event => renderSearchResults(event.target.value));

  $("[data-cart-drawer]").addEventListener("click", event => {
    if (event.target.matches("[data-cart-drawer]")) closeCart();
  });
  $("[data-account-modal]").addEventListener("click", event => {
    if (event.target.matches("[data-account-modal]")) closeAccount();
  });
  $("[data-menu-drawer]").addEventListener("click", event => {
    if (event.target.matches("[data-menu-drawer]")) closeMenu();
  });
  $("[data-search-modal]").addEventListener("click", event => {
    if (event.target.matches("[data-search-modal]")) closeSearch();
  });

  $$("[data-auth-tab]").forEach(button => {
    button.addEventListener("click", () => {
      $$("[data-auth-tab]").forEach(item => item.classList.toggle("is-active", item === button));
      $("[data-login-form]").classList.toggle("is-hidden", button.dataset.authTab !== "login");
      $("[data-register-form]").classList.toggle("is-hidden", button.dataset.authTab !== "register");
    });
  });

  $(".catalog-toolbar").addEventListener("click", event => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    setProductFilter(button.dataset.filter);
  });

  document.addEventListener("click", async event => {
    const menuFilter = event.target.closest("[data-menu-filter]");
    if (menuFilter) {
      closeMenu();
      window.location.hash = "shop";
      setView("shop");
      setProductFilter(menuFilter.dataset.menuFilter);
      return;
    }

    const menuLink = event.target.closest("[data-menu-link]");
    if (menuLink) {
      closeMenu();
      return;
    }

    const suggestion = event.target.closest("[data-search-suggestion]");
    if (suggestion) {
      const input = $("[data-search-input]");
      input.value = suggestion.dataset.searchSuggestion;
      renderSearchResults(input.value);
      input.focus();
      return;
    }

    const searchProduct = event.target.closest("[data-search-product]");
    if (searchProduct) {
      const product = productById(searchProduct.dataset.searchProduct);
      closeSearch();
      if (product) {
        window.location.hash = "shop";
        setView("shop");
        setProductFilter(product.category || "all");
      }
      return;
    }

    const searchArchive = event.target.closest("[data-search-archive]");
    if (searchArchive) {
      closeSearch();
      window.location.hash = "archive";
      setView("archive");
      return;
    }

    const topFilter = event.target.closest("[data-top-filter]");
    if (topFilter) {
      event.preventDefault();
      window.location.hash = "shop";
      setView("shop");
      setProductFilter(topFilter.dataset.topFilter);
      return;
    }

    const addButton = event.target.closest("[data-add-to-cart]");
    if (addButton) {
      if (!state.user) {
        toast("Сначала войдите в аккаунт, чтобы корзина сохранилась");
        openAccount();
        return;
      }
      const id = addButton.dataset.addToCart;
      const size = $(`[data-size="${CSS.escape(id)}"]`)?.value || "";
      const note = $(`[data-note="${CSS.escape(id)}"]`)?.value || "";
      try {
        const data = await api("/api/cart", {
          method: "POST",
          body: JSON.stringify({ productId: id, quantity: 1, size, note })
        });
        state.cart = data.cart || [];
        renderAll();
        toast("Добавлено в корзину");
        openCart();
      } catch (error) {
        toast(error.message);
      }
      return;
    }

    const qtyButton = event.target.closest("[data-qty]");
    if (qtyButton) {
      try {
        const data = await api(`/api/cart/${qtyButton.dataset.qty}`, {
          method: "PATCH",
          body: JSON.stringify({ quantity: Number(qtyButton.dataset.next) })
        });
        state.cart = data.cart || [];
        renderAll();
      } catch (error) {
        toast(error.message);
      }
      return;
    }

    const removeButton = event.target.closest("[data-remove-cart]");
    if (removeButton) {
      try {
        const data = await api(`/api/cart/${removeButton.dataset.removeCart}`, { method: "DELETE" });
        state.cart = data.cart || [];
        renderAll();
      } catch (error) {
        toast(error.message);
      }
      return;
    }

    const editProduct = event.target.closest("[data-edit-product]");
    if (editProduct) {
      const product = productById(editProduct.dataset.editProduct);
      if (product) fillProductForm(product);
      return;
    }

    const deleteProduct = event.target.closest("[data-delete-product]");
    if (deleteProduct) {
      try {
        const data = await api(`/api/admin/products/${deleteProduct.dataset.deleteProduct}`, { method: "DELETE" }, "admin");
        state.products = data.products || [];
        state.actions = data.actions || state.actions;
        renderAll();
        toast("Товар удалён");
      } catch (error) {
        toast(error.message);
      }
    }
  });

  $("[data-login-form]").addEventListener("submit", async event => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const identifier = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    try {
      if (identifier.toUpperCase() === "FRONTE") {
        const data = await api("/api/admin/login", {
          method: "POST",
          body: JSON.stringify({
            username: identifier.toUpperCase(),
            password
          })
        }, "admin");
        localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
        localStorage.removeItem(USER_TOKEN_KEY);
        state.admin = data.admin;
        state.user = null;
        state.cart = [];
        state.orders = [];
        await refreshAdmin();
        renderAll();
        closeAccount();
        window.location.hash = "admin";
        setView("admin");
        toast("Админ-панель открыта");
        return;
      }

      const data = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({
          email: identifier,
          password
        })
      });
      localStorage.setItem(USER_TOKEN_KEY, data.token);
      state.user = data.user;
      state.cart = data.cart || [];
      state.orders = data.orders || [];
      renderAll();
      toast("Вы вошли в аккаунт");
    } catch (error) {
      toast(error.message);
    }
  });

  $("[data-register-form]").addEventListener("submit", async event => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      const data = await api("/api/register", {
        method: "POST",
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          password: formData.get("password")
        })
      });
      localStorage.setItem(USER_TOKEN_KEY, data.token);
      state.user = data.user;
      state.cart = data.cart || [];
      state.orders = data.orders || [];
      renderAll();
      toast("Аккаунт создан");
    } catch (error) {
      toast(error.message);
    }
  });

  $("[data-logout]").addEventListener("click", async () => {
    await api("/api/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem(USER_TOKEN_KEY);
    state.user = null;
    state.cart = [];
    state.orders = [];
    renderAll();
    toast("Вы вышли");
  });

  $("[data-admin-logout]").addEventListener("click", async () => {
    await api("/api/logout", { method: "POST" }, "admin").catch(() => {});
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    state.admin = null;
    state.actions = [];
    renderAll();
    toast("Вы вышли из админки");
  });

  $("[data-open-admin-panel]").addEventListener("click", () => {
    closeAccount();
    window.location.hash = "admin";
    setView("admin");
  });

  $("[data-checkout-form]").addEventListener("submit", async event => {
    event.preventDefault();
    if (!state.user) {
      openAccount();
      toast("Сначала войдите в аккаунт");
      return;
    }
    const formData = new FormData(event.currentTarget);
    try {
      const data = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({ comment: formData.get("comment") })
      });
      state.cart = data.cart || [];
      state.orders = data.orders || [];
      event.currentTarget.reset();
      renderAll();
      toast(`Заказ ${data.order.number} отправлен`);
    } catch (error) {
      toast(error.message);
    }
  });

  $("[data-product-form]").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const editingId = form.elements.id.value;
    try {
      const payload = await productPayload(form);
      const data = await api(editingId ? `/api/admin/products/${editingId}` : "/api/admin/products", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      }, "admin");
      state.products = data.products || state.products;
      state.actions = data.actions || state.actions;
      resetProductForm();
      renderAll();
      toast(editingId ? "Товар обновлён" : "Товар создан");
    } catch (error) {
      toast(error.message);
    }
  });

  $("[data-archive-form]").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const editingId = form.elements.id.value;
    try {
      const payload = await archivePayload(form);
      const data = await api(editingId ? `/api/admin/archive/${editingId}` : "/api/admin/archive", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      }, "admin");
      state.archive = data.archive || state.archive;
      state.actions = data.actions || state.actions;
      resetArchiveForm();
      renderAll();
      toast(editingId ? "Архив обновлён" : "Архив добавлен");
    } catch (error) {
      toast(error.message);
    }
  });

  $("[data-reset-product-form]").addEventListener("click", resetProductForm);
  $("[data-reset-archive-form]").addEventListener("click", resetArchiveForm);
}

async function init() {
  bindEvents();
  await refreshShop();
  await refreshMe();
  await refreshAdmin();
  renderAll();
  routeFromHash();
}

init().catch(error => {
  console.error(error);
  toast(error.message || "Ошибка загрузки сайта");
});
