const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 5173);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const BODY_LIMIT = 25 * 1024 * 1024;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const DEFAULT_DB = {
  users: [],
  sessions: [],
  products: [
    {
      id: "p-cashmere-atelier",
      title: "Atelier Cashmere Crew",
      category: "bespoke",
      material: "Italian cashmere, hand-linked seams",
      price: 138000,
      status: "available",
      edition: "Made to order",
      image: "/assets/knitwear-hero.png",
      images: ["/assets/knitwear-hero.png"],
      description:
        "Bespoke jumper with measured shoulder line, quiet volume and hand-finished neckline. Produced individually after a private fitting.",
      details: ["4-6 weeks atelier timing", "Personal measurement card", "Hand wash consultation included"],
      createdAt: "2026-07-02T12:00:00.000Z",
      updatedAt: "2026-07-02T12:00:00.000Z"
    },
    {
      id: "p-silk-rib-cardigan",
      title: "Silk Rib Cardigan",
      category: "women",
      material: "Silk cotton blend, narrow rib, mother-of-pearl buttons",
      price: 112000,
      status: "available",
      edition: "Limited atelier run",
      image: "/assets/fronte-parte-monogram.jpg",
      images: ["/assets/fronte-parte-monogram.jpg", "/assets/knitwear-hero.png"],
      description:
        "A refined cardigan built around soft structure, long cuffs and a close bespoke fit. Each piece is blocked by hand.",
      details: ["Numbered atelier card", "Bespoke sleeve length", "Private color request available"],
      createdAt: "2026-07-02T12:05:00.000Z",
      updatedAt: "2026-07-02T12:05:00.000Z"
    },
    {
      id: "p-merino-shell",
      title: "Merino Sculpted Shell",
      category: "men",
      material: "Fine merino, compact Milano stitch",
      price: 97000,
      status: "available",
      edition: "Permanent bespoke line",
      image: "/assets/knitwear-hero.png",
      images: ["/assets/knitwear-hero.png"],
      description:
        "A compact hand-finished shell with precise armhole and sculptural hem. Designed for clean layering under tailoring.",
      details: ["Made by measurements", "Atelier repair service", "Custom yarn tone by request"],
      createdAt: "2026-07-02T12:10:00.000Z",
      updatedAt: "2026-07-02T12:10:00.000Z"
    }
  ],
  archive: [
    {
      id: "a-black-line-study",
      title: "Black Line Study",
      year: "2026",
      technique: "Hand-intarsia panel, archive sample",
      image: "/assets/fronte-parte-logo-full.png",
      description:
        "A monochrome study of the FRONTE PARTE monogram proportions translated into hand-knit surface work.",
      createdAt: "2026-07-02T12:15:00.000Z",
      updatedAt: "2026-07-02T12:15:00.000Z"
    },
    {
      id: "a-private-fitting-cardigan",
      title: "Private Fitting Cardigan",
      year: "2025",
      technique: "Hand-linked rib cardigan",
      image: "/assets/knitwear-hero.png",
      description:
        "A one-of-one cardigan from the private fitting archive, focused on sleeve architecture and shoulder softness.",
      createdAt: "2026-07-02T12:20:00.000Z",
      updatedAt: "2026-07-02T12:20:00.000Z"
    }
  ],
  adminActions: [
    {
      id: "act-seed",
      actor: "system",
      type: "seed",
      message: "Создан стартовый каталог FRONTE PARTE",
      createdAt: "2026-07-02T12:25:00.000Z"
    }
  ]
};

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = "";
    req.on("data", chunk => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(new Error("Request body is too large"));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function id(prefix) {
  return `${prefix}-${crypto.randomBytes(8).toString("hex")}`;
}

function now() {
  return new Date().toISOString();
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto
    .pbkdf2Sync(String(password), salt, 100000, 64, "sha512")
    .toString("hex");
  return { salt, hash };
}

function verifyPassword(password, user) {
  if (!user || !user.passwordHash || !user.passwordSalt) return false;
  const candidate = hashPassword(password, user.passwordSalt);
  return crypto.timingSafeEqual(Buffer.from(candidate.hash), Buffer.from(user.passwordHash));
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt
  };
}

function createSession(db, ownerId, role) {
  const token = crypto.randomBytes(32).toString("hex");
  db.sessions.push({
    token,
    ownerId,
    role,
    createdAt: now()
  });
  return token;
}

function getAuth(req, db, role) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const session = db.sessions.find(item => item.token === token);
  if (!session || (role && session.role !== role)) {
    return null;
  }
  if (session.role === "user") {
    const user = db.users.find(item => item.id === session.ownerId);
    if (!user) return null;
    return { token, session, user };
  }
  return { token, session, admin: { username: session.ownerId } };
}

function productSnapshot(product, item) {
  return {
    productId: product.id,
    title: product.title,
    price: Number(product.price || 0),
    image: product.image,
    material: product.material,
    edition: product.edition,
    quantity: Number(item.quantity || 1),
    size: item.size || "",
    note: item.note || ""
  };
}

function formatOrderNumber() {
  const stamp = Date.now().toString().slice(-7);
  return `FP-${stamp}`;
}

function logAction(db, actor, type, message) {
  db.adminActions.unshift({
    id: id("act"),
    actor,
    type,
    message,
    createdAt: now()
  });
  db.adminActions = db.adminActions.slice(0, 80);
}

function cleanProductInput(payload, existing = {}) {
  const title = String(payload.title ?? existing.title ?? "").trim();
  const price = Number(payload.price ?? existing.price ?? 0);
  const images = Array.isArray(payload.images)
    ? payload.images.map(item => String(item).trim()).filter(Boolean)
    : existing.images || [];
  const image = String(payload.image || images[0] || existing.image || "/assets/knitwear-hero.png").trim();
  return {
    title,
    category: String(payload.category ?? existing.category ?? "bespoke").trim() || "bespoke",
    material: String(payload.material ?? existing.material ?? "").trim(),
    price: Number.isFinite(price) ? price : Number(existing.price || 0),
    status: String(payload.status ?? existing.status ?? "available").trim() || "available",
    edition: String(payload.edition ?? existing.edition ?? "Made to order").trim(),
    image,
    images: images.length ? images : [image],
    description: String(payload.description ?? existing.description ?? "").trim(),
    details: Array.isArray(payload.details)
      ? payload.details.map(item => String(item).trim()).filter(Boolean)
      : existing.details || []
  };
}

function cleanArchiveInput(payload, existing = {}) {
  const title = String(payload.title ?? existing.title ?? "").trim();
  return {
    title,
    year: String(payload.year ?? existing.year ?? new Date().getFullYear()).trim(),
    technique: String(payload.technique ?? existing.technique ?? "").trim(),
    image: String(payload.image ?? existing.image ?? "/assets/knitwear-hero.png").trim(),
    description: String(payload.description ?? existing.description ?? "").trim()
  };
}

async function handleApi(req, res, url) {
  const db = readDb();
  const method = req.method;
  const pathname = url.pathname;

  if (method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, { ok: true, service: "FRONTE PARTE" });
    return;
  }

  if (method === "GET" && pathname === "/api/products") {
    sendJson(res, 200, { products: db.products });
    return;
  }

  if (method === "GET" && pathname === "/api/archive") {
    sendJson(res, 200, { archive: db.archive });
    return;
  }

  if (method === "POST" && pathname === "/api/register") {
    const body = await collectBody(req);
    const name = String(body.name || "").trim();
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    if (!name || !email || password.length < 6) {
      sendError(res, 400, "Введите имя, email и пароль от 6 символов");
      return;
    }
    if (db.users.some(user => user.email === email)) {
      sendError(res, 409, "Аккаунт с таким email уже существует");
      return;
    }
    const passwordData = hashPassword(password);
    const user = {
      id: id("usr"),
      name,
      email,
      passwordSalt: passwordData.salt,
      passwordHash: passwordData.hash,
      cart: [],
      orders: [],
      createdAt: now(),
      updatedAt: now()
    };
    db.users.push(user);
    const token = createSession(db, user.id, "user");
    writeDb(db);
    sendJson(res, 201, { token, user: publicUser(user), cart: [], orders: [] });
    return;
  }

  if (method === "POST" && pathname === "/api/login") {
    const body = await collectBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const user = db.users.find(item => item.email === email);
    if (!verifyPassword(password, user)) {
      sendError(res, 401, "Неверный email или пароль");
      return;
    }
    const token = createSession(db, user.id, "user");
    writeDb(db);
    sendJson(res, 200, { token, user: publicUser(user), cart: user.cart || [], orders: user.orders || [] });
    return;
  }

  if (method === "POST" && pathname === "/api/logout") {
    const auth = getAuth(req, db);
    if (auth) {
      db.sessions = db.sessions.filter(session => session.token !== auth.token);
      writeDb(db);
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  if (method === "GET" && pathname === "/api/me") {
    const auth = getAuth(req, db, "user");
    if (!auth) {
      sendError(res, 401, "Нужно войти в аккаунт");
      return;
    }
    sendJson(res, 200, {
      user: publicUser(auth.user),
      cart: auth.user.cart || [],
      orders: auth.user.orders || []
    });
    return;
  }

  if (method === "GET" && pathname === "/api/cart") {
    const auth = getAuth(req, db, "user");
    if (!auth) {
      sendError(res, 401, "Нужно войти в аккаунт");
      return;
    }
    sendJson(res, 200, { cart: auth.user.cart || [] });
    return;
  }

  if (method === "POST" && pathname === "/api/cart") {
    const auth = getAuth(req, db, "user");
    if (!auth) {
      sendError(res, 401, "Нужно войти в аккаунт, чтобы корзина синхронизировалась");
      return;
    }
    const body = await collectBody(req);
    const product = db.products.find(item => item.id === body.productId);
    if (!product) {
      sendError(res, 404, "Товар не найден");
      return;
    }
    const quantity = Math.max(1, Number(body.quantity || 1));
    const size = String(body.size || "").trim();
    const note = String(body.note || "").trim();
    auth.user.cart = auth.user.cart || [];
    const existing = auth.user.cart.find(item => item.productId === product.id && item.size === size && item.note === note);
    if (existing) {
      existing.quantity = Number(existing.quantity || 1) + quantity;
      existing.updatedAt = now();
    } else {
      auth.user.cart.unshift({
        id: id("cart"),
        productId: product.id,
        quantity,
        size,
        note,
        addedAt: now(),
        updatedAt: now()
      });
    }
    auth.user.updatedAt = now();
    writeDb(db);
    sendJson(res, 200, { cart: auth.user.cart });
    return;
  }

  const cartMatch = pathname.match(/^\/api\/cart\/([^/]+)$/);
  if (cartMatch && method === "PATCH") {
    const auth = getAuth(req, db, "user");
    if (!auth) {
      sendError(res, 401, "Нужно войти в аккаунт");
      return;
    }
    const body = await collectBody(req);
    const item = (auth.user.cart || []).find(cartItem => cartItem.id === cartMatch[1]);
    if (!item) {
      sendError(res, 404, "Позиция корзины не найдена");
      return;
    }
    item.quantity = Math.max(1, Number(body.quantity || item.quantity || 1));
    item.updatedAt = now();
    auth.user.updatedAt = now();
    writeDb(db);
    sendJson(res, 200, { cart: auth.user.cart });
    return;
  }

  if (cartMatch && method === "DELETE") {
    const auth = getAuth(req, db, "user");
    if (!auth) {
      sendError(res, 401, "Нужно войти в аккаунт");
      return;
    }
    auth.user.cart = (auth.user.cart || []).filter(cartItem => cartItem.id !== cartMatch[1]);
    auth.user.updatedAt = now();
    writeDb(db);
    sendJson(res, 200, { cart: auth.user.cart });
    return;
  }

  if (method === "GET" && pathname === "/api/orders") {
    const auth = getAuth(req, db, "user");
    if (!auth) {
      sendError(res, 401, "Нужно войти в аккаунт");
      return;
    }
    sendJson(res, 200, { orders: auth.user.orders || [] });
    return;
  }

  if (method === "POST" && pathname === "/api/orders") {
    const auth = getAuth(req, db, "user");
    if (!auth) {
      sendError(res, 401, "Нужно войти в аккаунт");
      return;
    }
    if (!auth.user.cart || !auth.user.cart.length) {
      sendError(res, 400, "Корзина пустая");
      return;
    }
    const body = await collectBody(req);
    const items = auth.user.cart.map(item => {
      const product = db.products.find(productItem => productItem.id === item.productId);
      return product ? productSnapshot(product, item) : null;
    }).filter(Boolean);
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const order = {
      id: id("ord"),
      number: formatOrderNumber(),
      status: "Запрос отправлен в ателье",
      items,
      total,
      comment: String(body.comment || "").trim(),
      createdAt: now()
    };
    auth.user.orders = auth.user.orders || [];
    auth.user.orders.unshift(order);
    auth.user.cart = [];
    auth.user.updatedAt = now();
    writeDb(db);
    sendJson(res, 201, { order, cart: auth.user.cart, orders: auth.user.orders });
    return;
  }

  if (method === "POST" && pathname === "/api/admin/login") {
    const body = await collectBody(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();
    if (username !== "FRONTE" || password !== "PARTE") {
      sendError(res, 401, "Неверный логин или пароль админки");
      return;
    }
    const token = createSession(db, "FRONTE", "admin");
    logAction(db, "FRONTE", "login", "Выполнен вход в админ-панель");
    writeDb(db);
    sendJson(res, 200, { token, admin: { username: "FRONTE" } });
    return;
  }

  if (method === "GET" && pathname === "/api/admin/me") {
    const auth = getAuth(req, db, "admin");
    if (!auth) {
      sendError(res, 401, "Нужно войти в админ-панель");
      return;
    }
    sendJson(res, 200, { admin: auth.admin });
    return;
  }

  if (method === "GET" && pathname === "/api/admin/actions") {
    const auth = getAuth(req, db, "admin");
    if (!auth) {
      sendError(res, 401, "Нужно войти в админ-панель");
      return;
    }
    sendJson(res, 200, { actions: db.adminActions });
    return;
  }

  if (method === "POST" && pathname === "/api/admin/products") {
    const auth = getAuth(req, db, "admin");
    if (!auth) {
      sendError(res, 401, "Нужно войти в админ-панель");
      return;
    }
    const body = await collectBody(req);
    const product = {
      id: id("prd"),
      ...cleanProductInput(body),
      createdAt: now(),
      updatedAt: now()
    };
    if (!product.title || !product.price) {
      sendError(res, 400, "У товара должны быть название и цена");
      return;
    }
    db.products.unshift(product);
    logAction(db, "FRONTE", "product:create", `Создан товар: ${product.title}`);
    writeDb(db);
    sendJson(res, 201, { product, products: db.products, actions: db.adminActions });
    return;
  }

  const productMatch = pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
  if (productMatch && method === "PATCH") {
    const auth = getAuth(req, db, "admin");
    if (!auth) {
      sendError(res, 401, "Нужно войти в админ-панель");
      return;
    }
    const product = db.products.find(item => item.id === productMatch[1]);
    if (!product) {
      sendError(res, 404, "Товар не найден");
      return;
    }
    const body = await collectBody(req);
    Object.assign(product, cleanProductInput(body, product), { updatedAt: now() });
    logAction(db, "FRONTE", "product:update", `Обновлён товар: ${product.title}`);
    writeDb(db);
    sendJson(res, 200, { product, products: db.products, actions: db.adminActions });
    return;
  }

  if (productMatch && method === "DELETE") {
    const auth = getAuth(req, db, "admin");
    if (!auth) {
      sendError(res, 401, "Нужно войти в админ-панель");
      return;
    }
    const product = db.products.find(item => item.id === productMatch[1]);
    db.products = db.products.filter(item => item.id !== productMatch[1]);
    if (product) {
      logAction(db, "FRONTE", "product:delete", `Удалён товар: ${product.title}`);
    }
    writeDb(db);
    sendJson(res, 200, { products: db.products, actions: db.adminActions });
    return;
  }

  if (method === "POST" && pathname === "/api/admin/archive") {
    const auth = getAuth(req, db, "admin");
    if (!auth) {
      sendError(res, 401, "Нужно войти в админ-панель");
      return;
    }
    const body = await collectBody(req);
    const archiveItem = {
      id: id("arc"),
      ...cleanArchiveInput(body),
      createdAt: now(),
      updatedAt: now()
    };
    if (!archiveItem.title) {
      sendError(res, 400, "У архивной работы должно быть название");
      return;
    }
    db.archive.unshift(archiveItem);
    logAction(db, "FRONTE", "archive:create", `Добавлена архивная работа: ${archiveItem.title}`);
    writeDb(db);
    sendJson(res, 201, { archiveItem, archive: db.archive, actions: db.adminActions });
    return;
  }

  const archiveMatch = pathname.match(/^\/api\/admin\/archive\/([^/]+)$/);
  if (archiveMatch && method === "PATCH") {
    const auth = getAuth(req, db, "admin");
    if (!auth) {
      sendError(res, 401, "Нужно войти в админ-панель");
      return;
    }
    const archiveItem = db.archive.find(item => item.id === archiveMatch[1]);
    if (!archiveItem) {
      sendError(res, 404, "Архивная работа не найдена");
      return;
    }
    const body = await collectBody(req);
    Object.assign(archiveItem, cleanArchiveInput(body, archiveItem), { updatedAt: now() });
    logAction(db, "FRONTE", "archive:update", `Обновлена архивная работа: ${archiveItem.title}`);
    writeDb(db);
    sendJson(res, 200, { archiveItem, archive: db.archive, actions: db.adminActions });
    return;
  }

  if (archiveMatch && method === "DELETE") {
    const auth = getAuth(req, db, "admin");
    if (!auth) {
      sendError(res, 401, "Нужно войти в админ-панель");
      return;
    }
    const archiveItem = db.archive.find(item => item.id === archiveMatch[1]);
    db.archive = db.archive.filter(item => item.id !== archiveMatch[1]);
    if (archiveItem) {
      logAction(db, "FRONTE", "archive:delete", `Удалена архивная работа: ${archiveItem.title}`);
    }
    writeDb(db);
    sendJson(res, 200, { archive: db.archive, actions: db.adminActions });
    return;
  }

  sendError(res, 404, "API route not found");
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const requested = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!requested.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(requested, (error, data) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (indexError, indexData) => {
        if (indexError) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": MIME_TYPES[".html"] });
        res.end(indexData);
      });
      return;
    }
    const ext = path.extname(requested).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=3600"
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    serveStatic(req, res, url);
  } catch (error) {
    sendError(res, error.message === "Request body is too large" ? 413 : 500, error.message || "Server error");
  }
});

ensureDb();
server.listen(PORT, () => {
  console.log(`FRONTE PARTE site is running at http://127.0.0.1:${PORT}`);
});
