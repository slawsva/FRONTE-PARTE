import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { access, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
loadDotEnv(path.join(rootDir, ".env"));

const distDir = path.join(rootDir, "dist");
const dataDir = process.env.FP_DATA_DIR
  ? path.resolve(process.env.FP_DATA_DIR)
  : path.join(rootDir, ".fp-secure-data");
const productsFile = path.join(dataDir, "products.json");
const seedFile = fileURLToPath(new URL("./seed-products.json", import.meta.url));

const PORT = Number(process.env.PORT || process.env.FP_PORT || 8787);
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";
const SESSION_COOKIE = "fp_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const ADMIN_LOGIN = process.env.FP_ADMIN_LOGIN || "FRONTE";
const ADMIN_EMAIL = process.env.FP_ADMIN_EMAIL || "admin@fronteparte.com";
const ADMIN_NAME = process.env.FP_ADMIN_NAME || "FRONTE PARTE";
const ADMIN_PASSWORD = process.env.FP_ADMIN_PASSWORD || "";
const ADMIN_PASSWORD_HASH = process.env.FP_ADMIN_PASSWORD_HASH || "";
const SESSION_SECRET =
  process.env.FP_SESSION_SECRET || "";
const allowedOrigins = new Set(
  (process.env.FP_ALLOWED_ORIGINS || `http://localhost:${PORT},http://127.0.0.1:${PORT},http://localhost:5173,http://127.0.0.1:5173`)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

if (process.argv[2] === "hash") {
  const plain = process.argv[3];
  if (!plain) {
    console.error("Usage: node server/secure-server.mjs hash <password>");
    process.exit(1);
  }
  console.log(makePasswordHash(plain));
  process.exit(0);
}

if (!SESSION_SECRET) {
  console.error("FP_SESSION_SECRET is required. Copy .env.example to .env and set real secrets.");
  process.exit(1);
}

if (!ADMIN_PASSWORD_HASH && !ADMIN_PASSWORD) {
  console.error("Set FP_ADMIN_PASSWORD_HASH or FP_ADMIN_PASSWORD.");
  process.exit(1);
}

const sessions = new Map();
const loginAttempts = new Map();
let productWriteQueue = Promise.resolve();

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index < 1) continue;

    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function makePasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 210000;
  const derived = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$${iterations}$${salt}$${derived}`;
}

function verifyPassword(candidate) {
  if (ADMIN_PASSWORD_HASH) {
    const [algorithm, iterationsRaw, salt, expectedHex] = ADMIN_PASSWORD_HASH.split("$");
    if (algorithm !== "pbkdf2_sha256" || !iterationsRaw || !salt || !expectedHex) return false;
    const iterations = Number(iterationsRaw);
    const actual = crypto.pbkdf2Sync(candidate, salt, iterations, 32, "sha256");
    const expected = Buffer.from(expectedHex, "hex");
    return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
  }

  const actual = crypto.createHmac("sha256", SESSION_SECRET).update(candidate).digest();
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(actual, expected);
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function sessionKey(token) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(token).digest("hex");
}

function createSession() {
  const token = randomToken();
  const csrfToken = randomToken();
  const session = {
    csrfToken,
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };
  sessions.set(sessionKey(token), session);
  return { token, session };
}

function getSession(req) {
  const token = parseCookies(req.headers.cookie || "")[SESSION_COOKIE];
  if (!token) return null;
  const session = sessions.get(sessionKey(token));
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(sessionKey(token));
    return null;
  }
  return { token, session };
}

function parseCookies(raw) {
  return Object.fromEntries(
    raw
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index < 0) return [part, ""];
        return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function setSessionCookie(req, res, token) {
  const secure = process.env.FP_COOKIE_SECURE === "true" || req.headers["x-forwarded-proto"] === "https";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure ? "; Secure" : ""}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket.remoteAddress || "unknown";
}

function isLoginRateLimited(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const record = loginAttempts.get(ip) || { count: 0, resetAt: now + windowMs };

  if (record.resetAt <= now) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }

  record.count += 1;
  loginAttempts.set(ip, record);
  return record.count > 8;
}

function resetLoginAttempts(req) {
  loginAttempts.delete(getClientIp(req));
}

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join("; ")
  );
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
}

function assertTrustedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  return allowedOrigins.has(origin);
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function sendError(res, status, message = "Request rejected") {
  sendJson(res, status, { error: message });
}

async function readJson(req, maxBytes = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("Payload too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

async function ensureProductsFile() {
  await mkdir(dataDir, { recursive: true });
  try {
    await access(productsFile, constants.F_OK);
  } catch {
    const seed = await readFile(seedFile, "utf8");
    await writeFile(productsFile, seed, { mode: 0o600 });
  }
}

async function readProducts() {
  await ensureProductsFile();
  const raw = await readFile(productsFile, "utf8");
  const products = JSON.parse(raw);
  return Array.isArray(products) ? products.map((product) => normalizeProduct(product, product.id)) : [];
}

async function writeProducts(products) {
  productWriteQueue = productWriteQueue.then(async () => {
    await mkdir(dataDir, { recursive: true });
    const tmp = `${productsFile}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(products, null, 2), { mode: 0o600 });
    await rename(tmp, productsFile);
  });
  return productWriteQueue;
}

function cleanString(value, field, maxLength) {
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) throw new Error(`${field} has invalid length`);
  return trimmed;
}

function cleanOptionalString(value, field, maxLength) {
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error(`${field} has invalid length`);
  return trimmed;
}

function cleanImageUrl(value) {
  const url = cleanString(value, "image", 700);
  const parsed = new URL(url);
  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP(S) image URLs are allowed");
  }
  return parsed.toString();
}

function slugify(value, fallbackId) {
  const slug = value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return slug || fallbackId;
}

function normalizeProduct(input, existingId) {
  const id = existingId
    ? cleanString(String(existingId), "id", 80).replace(/[^a-zA-Z0-9_-]/g, "")
    : `fp-${Date.now()}-${randomToken(4)}`;
  const name = cleanString(input.name, "name", 120);
  const nameRu = cleanString(input.nameRu || input.name, "nameRu", 160);
  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 0 || price > 100000000) {
    throw new Error("price is invalid");
  }

  const images = Array.isArray(input.images) ? input.images.map(cleanImageUrl).slice(0, 8) : [];
  const sizes = Array.isArray(input.sizes)
    ? input.sizes.map((size) => cleanString(String(size), "size", 16)).slice(0, 20)
    : [];
  const category = cleanString(input.category || "tops", "category", 40).replace(/[^a-zA-Z0-9_-]/g, "");

  return {
    id,
    slug: slugify(input.slug || name, id),
    name,
    nameRu,
    price,
    description: cleanOptionalString(input.description || "", "description", 1600),
    descriptionRu: cleanOptionalString(input.descriptionRu || "", "descriptionRu", 1800),
    images,
    category,
    sizes,
    inStock: Boolean(input.inStock),
    featured: Boolean(input.featured),
  };
}

function requireAdmin(req, res) {
  if (!assertTrustedOrigin(req)) {
    sendError(res, 403, "Untrusted origin");
    return null;
  }

  const auth = getSession(req);
  if (!auth) {
    sendError(res, 401, "Authentication required");
    return null;
  }

  if (req.headers["x-csrf-token"] !== auth.session.csrfToken) {
    sendError(res, 403, "Bad CSRF token");
    return null;
  }

  return auth;
}

function publicAdminUser() {
  return {
    id: "admin-fp",
    email: ADMIN_EMAIL,
    name: ADMIN_NAME,
    isAdmin: true,
  };
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && pathname === "/api/products") {
    return sendJson(res, 200, await readProducts());
  }

  if (req.method === "GET" && pathname === "/api/auth/session") {
    const auth = getSession(req);
    if (!auth) return sendJson(res, 200, { authenticated: false });
    return sendJson(res, 200, {
      authenticated: true,
      user: publicAdminUser(),
      csrfToken: auth.session.csrfToken,
    });
  }

  if (req.method === "POST" && pathname === "/api/auth/login") {
    if (!assertTrustedOrigin(req)) return sendError(res, 403, "Untrusted origin");
    if (isLoginRateLimited(req)) return sendError(res, 429, "Too many login attempts");

    const body = await readJson(req, 8 * 1024);
    const login = String(body.login || "").trim();
    const password = String(body.password || "");
    const validLogin = login === ADMIN_LOGIN || login === ADMIN_EMAIL;

    if (!validLogin || !verifyPassword(password)) {
      return sendError(res, 401, "Invalid credentials");
    }

    resetLoginAttempts(req);
    const { token, session } = createSession();
    setSessionCookie(req, res, token);
    return sendJson(res, 200, {
      user: publicAdminUser(),
      csrfToken: session.csrfToken,
    });
  }

  if (req.method === "POST" && pathname === "/api/auth/logout") {
    const auth = requireAdmin(req, res);
    if (!auth) return;
    sessions.delete(sessionKey(auth.token));
    clearSessionCookie(res);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === "/api/products" && req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    const products = await readProducts();
    const body = await readJson(req);
    const product = normalizeProduct(body);
    const next = [...products, product];
    await writeProducts(next);
    return sendJson(res, 201, product);
  }

  const productMatch = pathname.match(/^\/api\/products\/([a-zA-Z0-9_-]+)(?:\/stock)?$/);
  if (productMatch) {
    if (!requireAdmin(req, res)) return;
    const id = productMatch[1];
    const products = await readProducts();
    const index = products.findIndex((product) => product.id === id);
    if (index < 0) return sendError(res, 404, "Product not found");

    if (req.method === "DELETE" && !pathname.endsWith("/stock")) {
      const next = products.filter((product) => product.id !== id);
      await writeProducts(next);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "PATCH" && pathname.endsWith("/stock")) {
      const body = await readJson(req, 4 * 1024);
      const updated = { ...products[index], inStock: Boolean(body.inStock) };
      const next = products.map((product) => (product.id === id ? updated : product));
      await writeProducts(next);
      return sendJson(res, 200, updated);
    }

    if (req.method === "PUT" && !pathname.endsWith("/stock")) {
      const body = await readJson(req);
      const updated = normalizeProduct(body, id);
      const next = products.map((product) => (product.id === id ? updated : product));
      await writeProducts(next);
      return sendJson(res, 200, updated);
    }
  }

  sendError(res, 404, "Not found");
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const decoded = decodeURIComponent(requested);
  const safePath = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(distDir, safePath);

  if (!filePath.startsWith(distDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = path.join(filePath, "index.html");
  } catch {
    filePath = path.join(distDir, "index.html");
  }

  try {
    await access(filePath, constants.R_OK);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
      "Cache-Control": filePath.endsWith("index.html") ? "no-store" : "public, max-age=31536000, immutable",
    });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  setSecurityHeaders(res);
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      return await handleApi(req, res, url.pathname);
    }
    return await serveStatic(req, res, url.pathname);
  } catch (error) {
    const status = error?.statusCode || 500;
    if (status >= 500) console.error(error);
    sendError(res, status, status >= 500 ? "Server error" : error.message);
  }
});

server.listen(PORT, () => {
  console.log(`FRONTE PARTE secure server: http://localhost:${PORT}`);
});
