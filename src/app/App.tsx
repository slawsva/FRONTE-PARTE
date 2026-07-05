/**
 * FRONTE PARTE — Luxury Bespoke Knitwear
 *
 * Full e-commerce implementation:
 *  - Auth (regular + server-protected admin)
 *  - Persistent cart per user (localStorage, syncs across "devices")
 *  - Admin panel: product CRUD + activity log
 *  - Bilingual (EN / RU)
 *  - SEO meta management
 *  - Luxury editorial design (Bodoni Moda + Jost)
 */

import React, {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  useMemo,
  FormEvent,
} from "react";
import {
  ShoppingBag,
  Menu,
  X,
  User,
  LogOut,
  Plus,
  Minus,
  Clock,
  ArrowRight,
  Check,
} from "lucide-react";
import heroWoolStillLife from "../imports/hero-wool-still-life.jpg";
import fpLogoDark from "../imports/fp-logo-dark-transparent.png";
import fpLogoLight from "../imports/fp-logo-transparent.png";

const archiveOriginalImages = Object.entries(
  import.meta.glob("../imports/archive-original/*.jpg", { eager: true, import: "default" })
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, src]) => src as string);

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:8787" : "");

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  csrfToken?: string
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    let message = "Request failed";
    try {
      const body = await res.json();
      message = body?.error || message;
    } catch {
      /* non-json response */
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type Lang = "en" | "ru";
type Page =
  | "home"
  | "shop"
  | "product"
  | "archive"
  | "soldOut"
  | "cart"
  | "checkout"
  | "auth"
  | "account"
  | "admin";

interface Product {
  id: string;
  slug: string;
  name: string;
  nameRu: string;
  price: number;
  description: string;
  descriptionRu: string;
  images: string[];
  category: string;
  sizes: string[];
  inStock: boolean;
  featured: boolean;
}

interface CartItem {
  productId: string;
  size: string;
  quantity: number;
}

interface AppUser {
  id: string;
  email: string;
  password: string;
  name: string;
  isAdmin: boolean;
}

interface AdminSession {
  user: Omit<AppUser, "password">;
  csrfToken: string;
}

interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
  date: string;
  status: "pending" | "confirmed" | "shipped" | "delivered";
  paymentMethod: string;
}

interface AdminActivity {
  id: string;
  action: string;
  actionRu: string;
  timestamp: string;
}

interface ArchivePiece {
  id: string;
  title: string;
  titleRu: string;
  season: string;
  year: number;
  description: string;
  descriptionRu: string;
  image: string;
  isUnique: boolean;
}

// ═══════════════════════════════════════════════════════════════
// TRANSLATIONS
// ═══════════════════════════════════════════════════════════════

const translations = {
  en: {
    nav: {
      shop: "COLLECTION",
      archive: "ARCHIVE",
      soldOut: "GONE",
      contact: "CONTACT",
      account: "ACCOUNT",
      cart: "CART",
      langToggle: "RU",
    },
    home: {
      hero: "Bespoke Knitwear",
      heroSub: "Handmade with intention",
      heroBtn: "Explore Collection",
      featuredTitle: "Selected Works",
      featuredAll: "ALL PIECES",
      storyLabel: "THE PROCESS",
      storyTitle: "The Art of Making",
      storyText:
        "Each piece is born from a conversation between hand and material. We source the finest merino, cashmere and alpaca, then knit every garment to order — no waste, no compromise.",
      storyBtn: "VIEW ARCHIVE",
      marquee: "BESPOKE · HANDMADE · ARTISAN · EXCLUSIVE · SLOW FASHION · ",
    },
    shop: {
      title: "Collection",
      all: "ALL",
      tops: "TOPS",
      outerwear: "OUTERWEAR",
      dresses: "DRESSES",
      accessories: "ACCESSORIES",
      addToCart: "Add to Cart",
      soldOut: "Sold Out",
    },
    product: {
      size: "SELECT SIZE",
      addToCart: "Add to Cart",
      added: "Added",
      description: "DESCRIPTION",
      shipping: "Made to order · Ships in 3–4 weeks",
      back: "Back to Collection",
      soldOut: "Sold Out",
    },
    archive: {
      title: "Archive",
      subtitle: "A record of handmade works",
      unique: "One of a Kind",
      limited: "Limited Edition",
    },
    soldOut: {
      title: "Gone Pieces",
      subtitle: "Sold works that have already found their person",
      empty: "No pieces have left the collection yet.",
      emptyBtn: "Explore Collection",
    },
    cart: {
      title: "Cart",
      empty: "Your cart is empty",
      emptyBtn: "Explore Collection",
      size: "SIZE",
      total: "TOTAL",
      checkout: "Proceed to Checkout",
      remove: "REMOVE",
    },
    checkout: {
      title: "Checkout",
      paymentTitle: "PAYMENT METHOD",
      summary: "ORDER SUMMARY",
      placeOrder: "Place Order",
      orderPlaced: "Order Placed",
      thankYou: "Thank you for your order!",
      orderRef: "Order reference",
      returnHome: "RETURN HOME",
      paymentNote: "Payment gateway will be connected soon",
    },
    auth: {
      signIn: "Sign In",
      createAccount: "Create Account",
      loginLabel: "LOGIN / EMAIL",
      email: "EMAIL",
      password: "PASSWORD",
      name: "YOUR NAME",
      signInBtn: "SIGN IN",
      createBtn: "CREATE ACCOUNT",
      toRegister: "New to FRONTE PARTE? Create account",
      toLogin: "Already have an account? Sign in",
      error: "Invalid credentials. Please try again.",
    },
    account: {
      title: "My Account",
      orders: "ORDER HISTORY",
      cartSection: "CURRENT CART",
      noOrders: "No orders yet.",
      emptyCart: "Cart is empty.",
      signOut: "SIGN OUT",
      viewCart: "VIEW CART →",
      status: {
        pending: "PENDING",
        confirmed: "CONFIRMED",
        shipped: "SHIPPED",
        delivered: "DELIVERED",
      },
    },
    admin: {
      title: "ADMIN PANEL",
      tabs: {
        products: "PRODUCTS",
        add: "ADD PRODUCT",
        edit: "EDIT PRODUCT",
        activity: "ACTIVITY",
      },
      nameEn: "NAME (EN)",
      nameRu: "NAME (RU)",
      price: "PRICE (₽)",
      descEn: "DESCRIPTION (EN)",
      descRu: "DESCRIPTION (RU)",
      imageUrls: "IMAGE URLS (comma-separated)",
      sizes: "SIZES (comma-separated)",
      category: "CATEGORY",
      inStock: "IN STOCK",
      featured: "FEATURED ON HOME",
      markSoldOut: "MARK SOLD OUT",
      restoreStock: "RETURN TO COLLECTION",
      save: "SAVE PRODUCT",
      cancel: "CANCEL",
      edit: "EDIT",
      delete: "DELETE",
      noActivity: "No activity recorded yet.",
    },
    footer: {
      contactTitle: "CONTACT",
      followTitle: "FOLLOW US",
      email: "hello@fronteparte.com",
      phone: "+7 915 266 0705",
      rights: "© 2026 FRONTE PARTE. All rights reserved.",
      made: "Made with care in Russia",
    },
    payment: {
      apple: "Apple Pay",
      google: "Google Pay",
      card: "Bank Card",
      cardRu: "Russian Bank Card",
      sbp: "SBP (QR Code)",
      usdt: "USDT TRC20",
      litecoin: "Litecoin",
    },
  },
  ru: {
    nav: {
      shop: "КОЛЛЕКЦИЯ",
      archive: "АРХИВ",
      soldOut: "УЖЕ УШЛО",
      contact: "КОНТАКТЫ",
      account: "КАБИНЕТ",
      cart: "КОРЗИНА",
      langToggle: "EN",
    },
    home: {
      hero: "Трикотаж ручной работы",
      heroSub: "Сделано с намерением",
      heroBtn: "Смотреть коллекцию",
      featuredTitle: "Избранные работы",
      featuredAll: "ВСЕ ИЗДЕЛИЯ",
      storyLabel: "ПРОЦЕСС",
      storyTitle: "Искусство создания",
      storyText:
        "Каждое изделие рождается из диалога между руками и материалом. Мы используем лучшее мерино, кашемир и альпаку, вяжем каждую вещь на заказ — без отходов, без компромиссов.",
      storyBtn: "СМОТРЕТЬ АРХИВ",
      marquee: "БЕСПОК · РУЧНАЯ РАБОТА · РЕМЕСЛО · ЭКСКЛЮЗИВ · МЕДЛЕННАЯ МОДА · ",
    },
    shop: {
      title: "Коллекция",
      all: "ВСЕ",
      tops: "ВЕРХ",
      outerwear: "ВЕРХНЯЯ ОДЕЖДА",
      dresses: "ПЛАТЬЯ",
      accessories: "АКСЕССУАРЫ",
      addToCart: "В корзину",
      soldOut: "Нет в наличии",
    },
    product: {
      size: "ВЫБЕРИТЕ РАЗМЕР",
      addToCart: "В корзину",
      added: "Добавлено",
      description: "ОПИСАНИЕ",
      shipping: "Под заказ · Доставка 3–4 недели",
      back: "Назад к коллекции",
      soldOut: "Нет в наличии",
    },
    archive: {
      title: "Архив",
      subtitle: "Летопись изделий ручной работы",
      unique: "Единственный экземпляр",
      limited: "Лимитированная серия",
    },
    soldOut: {
      title: "Уже ушло",
      subtitle: "Проданные работы, которые уже нашли своего человека",
      empty: "Пока все изделия ещё в коллекции.",
      emptyBtn: "Смотреть коллекцию",
    },
    cart: {
      title: "Корзина",
      empty: "Ваша корзина пуста",
      emptyBtn: "Смотреть коллекцию",
      size: "РАЗМЕР",
      total: "ИТОГО",
      checkout: "Перейти к оплате",
      remove: "УДАЛИТЬ",
    },
    checkout: {
      title: "Оформление заказа",
      paymentTitle: "СПОСОБ ОПЛАТЫ",
      summary: "СОСТАВ ЗАКАЗА",
      placeOrder: "Оформить заказ",
      orderPlaced: "Заказ оформлен",
      thankYou: "Спасибо за ваш заказ!",
      orderRef: "Номер заказа",
      returnHome: "НА ГЛАВНУЮ",
      paymentNote: "Платёжный шлюз будет подключён в ближайшее время",
    },
    auth: {
      signIn: "Вход",
      createAccount: "Регистрация",
      loginLabel: "ЛОГИН / EMAIL",
      email: "EMAIL",
      password: "ПАРОЛЬ",
      name: "ВАШЕ ИМЯ",
      signInBtn: "ВОЙТИ",
      createBtn: "СОЗДАТЬ АККАУНТ",
      toRegister: "Нет аккаунта? Зарегистрироваться",
      toLogin: "Уже есть аккаунт? Войти",
      error: "Неверные данные. Попробуйте снова.",
    },
    account: {
      title: "Мой кабинет",
      orders: "ИСТОРИЯ ЗАКАЗОВ",
      cartSection: "ТЕКУЩАЯ КОРЗИНА",
      noOrders: "Заказов пока нет.",
      emptyCart: "Корзина пуста.",
      signOut: "ВЫЙТИ",
      viewCart: "КОРЗИНА →",
      status: {
        pending: "ОЖИДАЕТ",
        confirmed: "ПОДТВЕРЖДЁН",
        shipped: "ОТПРАВЛЕН",
        delivered: "ДОСТАВЛЕН",
      },
    },
    admin: {
      title: "ПАНЕЛЬ УПРАВЛЕНИЯ",
      tabs: {
        products: "ТОВАРЫ",
        add: "ДОБАВИТЬ",
        edit: "РЕДАКТИРОВАТЬ",
        activity: "ДЕЙСТВИЯ",
      },
      nameEn: "НАЗВАНИЕ (EN)",
      nameRu: "НАЗВАНИЕ (RU)",
      price: "ЦЕНА (₽)",
      descEn: "ОПИСАНИЕ (EN)",
      descRu: "ОПИСАНИЕ (RU)",
      imageUrls: "URL ИЗОБРАЖЕНИЙ (через запятую)",
      sizes: "РАЗМЕРЫ (через запятую)",
      category: "КАТЕГОРИЯ",
      inStock: "В НАЛИЧИИ",
      featured: "НА ГЛАВНОЙ",
      markSoldOut: "РАСПРОДАНО",
      restoreStock: "ВЕРНУТЬ В КОЛЛЕКЦИЮ",
      save: "СОХРАНИТЬ",
      cancel: "ОТМЕНА",
      edit: "ИЗМЕНИТЬ",
      delete: "УДАЛИТЬ",
      noActivity: "Действий пока нет.",
    },
    footer: {
      contactTitle: "КОНТАКТЫ",
      followTitle: "МЫ В СЕТЯХ",
      email: "hello@fronteparte.com",
      phone: "+7 915 266 0705",
      rights: "© 2026 FRONTE PARTE. Все права защищены.",
      made: "Сделано с любовью в России",
    },
    payment: {
      apple: "Apple Pay",
      google: "Google Pay",
      card: "Банковская карта",
      cardRu: "Банковская карта RU",
      sbp: "СБП (оплата по QR)",
      usdt: "USDT TRC20",
      litecoin: "Litecoin",
    },
  },
};

// ═══════════════════════════════════════════════════════════════
// SEED DATA
// ═══════════════════════════════════════════════════════════════

const ADMIN_USER: AppUser = {
  id: "admin-fp",
  email: "admin@fronteparte.com",
  password: "",
  name: "FRONTE PARTE",
  isAdmin: true,
};

const SEED_PRODUCTS: Product[] = [
  {
    id: "fp-001",
    slug: "merino-turtleneck",
    name: "Merino Turtleneck",
    nameRu: "Водолазка из мериноса",
    price: 45000,
    description:
      "A refined turtleneck knitted from the finest extra-fine merino wool. Weightless warmth with a structured, architectural silhouette. Each piece takes approximately 12 hours to complete.",
    descriptionRu:
      "Изысканная водолазка, связанная из тончайшей экстра-файн шерсти мериноса. Невесомое тепло с чёткими, архитектурными линиями. Каждое изделие создаётся около 12 часов.",
    images: [
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=900&h=1200&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1583744946564-b52d01a7b0b8?w=900&h=1200&fit=crop&auto=format",
    ],
    category: "tops",
    sizes: ["XS", "S", "M", "L", "XL"],
    inStock: true,
    featured: true,
  },
  {
    id: "fp-002",
    slug: "cashmere-cardigan",
    name: "Cashmere Cardigan",
    nameRu: "Кашемировый кардиган",
    price: 78000,
    description:
      "Spun from Mongolian Grade A cashmere at its softest. Open front, oversized silhouette, singular presence. The weight and drape evolve beautifully with each wear.",
    descriptionRu:
      "Из монгольского кашемира класса A высшего сорта. Открытый перед, оверсайз-силуэт, особенная стать. Вес и драпировка становятся только лучше с каждой ноской.",
    images: [
      "https://images.unsplash.com/photo-1509631927661-8f47f5b56f81?w=900&h=1200&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1550614000-4895a10e1bfd?w=900&h=1200&fit=crop&auto=format",
    ],
    category: "outerwear",
    sizes: ["S", "M", "L", "XL"],
    inStock: true,
    featured: true,
  },
  {
    id: "fp-003",
    slug: "silk-blend-vest",
    name: "Silk-Blend Vest",
    nameRu: "Жилет с шёлком",
    price: 32000,
    description:
      "A gossamer-light vest woven from merino and mulberry silk. Fluid, luminous, effortlessly elegant.",
    descriptionRu:
      "Невесомый жилет из мериноса и шёлка тутового шелкопряда. Воздушный, лучистый, непринуждённо элегантный.",
    images: [
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&h=1200&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900&h=1200&fit=crop&auto=format",
    ],
    category: "tops",
    sizes: ["XS", "S", "M", "L"],
    inStock: true,
    featured: true,
  },
  {
    id: "fp-004",
    slug: "alpaca-coat",
    name: "Alpaca Coat",
    nameRu: "Пальто из альпаки",
    price: 125000,
    description:
      "Floor-grazing alpaca, hand-knitted over three weeks. A profound statement in restraint and craft.",
    descriptionRu:
      "Пальто до пола из альпаки, связанное вручную на протяжении трёх недель. Глубокое высказывание о сдержанности и мастерстве.",
    images: [
      "https://images.unsplash.com/photo-1548624149-f9e6f4d51949?w=900&h=1200&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1544966503-7f25c6d1fc15?w=900&h=1200&fit=crop&auto=format",
    ],
    category: "outerwear",
    sizes: ["S", "M", "L"],
    inStock: true,
    featured: false,
  },
  {
    id: "fp-005",
    slug: "boucle-jacket",
    name: "Bouclé Jacket",
    nameRu: "Жакет буклé",
    price: 95000,
    description:
      "Structured bouclé knit with deliberately raw edges. Architecture for the body.",
    descriptionRu:
      "Структурированная вязка буклé с намеренно необработанными краями. Архитектура для тела.",
    images: [
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&h=1200&fit=crop&auto=format",
    ],
    category: "outerwear",
    sizes: ["XS", "S", "M", "L", "XL"],
    inStock: true,
    featured: false,
  },
  {
    id: "fp-006",
    slug: "fine-rib-dress",
    name: "Fine Rib Dress",
    nameRu: "Платье тонкой вязки",
    price: 67000,
    description:
      "Column dress in fine rib knit. An unbroken vertical line from collar to hem.",
    descriptionRu:
      "Платье-столб тонкой рубчатой вязки. Непрерывная вертикальная линия от воротника до подола.",
    images: [
      "https://images.unsplash.com/photo-1485518882851-62656b9c5e8f?w=900&h=1200&fit=crop&auto=format",
    ],
    category: "dresses",
    sizes: ["XS", "S", "M", "L"],
    inStock: false,
    featured: false,
  },
];

const ARCHIVE_GROUP_SIZES = [3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 15, 1, 1, 1, 1, 1, 11];

const ARCHIVE_GROUPS = ARCHIVE_GROUP_SIZES.reduce<string[][]>((groups, size) => {
  const start = groups.reduce((total, group) => total + group.length, 0);
  groups.push(archiveOriginalImages.slice(start, start + size));
  return groups;
}, []);

const PAYMENT_METHODS = [
  { id: "apple_usd", labelKey: "apple" as const, currency: "USD", icon: "apple" },
  { id: "apple_eur", labelKey: "apple" as const, currency: "EUR", icon: "apple" },
  { id: "google_usd", labelKey: "google" as const, currency: "USD", icon: "google" },
  { id: "google_eur", labelKey: "google" as const, currency: "EUR", icon: "google" },
  { id: "card_usd", labelKey: "card" as const, currency: "USD", icon: "card" },
  { id: "card_eur", labelKey: "card" as const, currency: "EUR", icon: "card" },
  { id: "card_ru", labelKey: "cardRu" as const, currency: "RUB", icon: "card" },
  { id: "sbp", labelKey: "sbp" as const, currency: "RUB", icon: "sbp" },
  { id: "usdt", labelKey: "usdt" as const, currency: "USDT", icon: "crypto" },
  { id: "litecoin", labelKey: "litecoin" as const, currency: "LTC", icon: "crypto" },
];

// ═══════════════════════════════════════════════════════════════
// LOCAL STORAGE HOOK
// ═══════════════════════════════════════════════════════════════

function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  const set = useCallback(
    (v: T | ((p: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* quota exceeded */
        }
        return next;
      });
    },
    [key]
  );

  return [value, set];
}

// ═══════════════════════════════════════════════════════════════
// APP CONTEXT
// ═══════════════════════════════════════════════════════════════

interface AppCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  T: (typeof translations)["en"];
  page: Page;
  navigate: (p: Page, params?: Record<string, string>) => void;
  params: Record<string, string>;
  user: AppUser | null;
  isAdminAuthenticated: boolean;
  login: (loginStr: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => boolean;
  products: Product[];
  setProducts: (p: Product[] | ((prev: Product[]) => Product[])) => void;
  reloadProducts: () => Promise<void>;
  saveAdminProduct: (product: Omit<Product, "id">, id?: string) => Promise<Product>;
  deleteAdminProduct: (id: string) => Promise<void>;
  setAdminProductStock: (id: string, inStock: boolean) => Promise<Product>;
  cart: CartItem[];
  addToCart: (productId: string, size: string) => void;
  removeFromCart: (productId: string, size: string) => void;
  updateQty: (productId: string, size: string, qty: number) => void;
  cartCount: number;
  cartTotal: number;
  orders: Order[];
  placeOrder: (items: CartItem[], total: number, paymentMethod: string) => void;
  activity: AdminActivity[];
  logActivity: (action: string, actionRu: string) => void;
}

const Ctx = createContext<AppCtx | null>(null);

function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp outside provider");
  return ctx;
}

function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangRaw] = useLocalStorage<Lang>("fp_lang", "en");
  const [page, setPage] = useState<Page>("home");
  const [params, setParams] = useState<Record<string, string>>({});
  const [user, setUser] = useLocalStorage<AppUser | null>("fp_user", null);
  const [users, setUsers] = useLocalStorage<AppUser[]>("fp_users", []);
  const [products, setProducts] = useLocalStorage<Product[]>("fp_products", SEED_PRODUCTS);
  const [carts, setCarts] = useLocalStorage<Record<string, CartItem[]>>("fp_carts", {});
  const [orders, setOrders] = useLocalStorage<Order[]>("fp_orders", []);
  const [activity, setActivity] = useLocalStorage<AdminActivity[]>("fp_activity", []);
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);

  // Remove old client-side admin records if they exist from earlier builds.
  useEffect(() => {
    setUsers((prev) => prev.filter((u) => !u.isAdmin && u.id !== ADMIN_USER.id));
  }, [setUsers]);

  const reloadProducts = useCallback(async () => {
    const serverProducts = await apiRequest<Product[]>("/api/products");
    setProducts(serverProducts);
  }, [setProducts]);

  useEffect(() => {
    reloadProducts().catch(() => {
      /* The app can still render the bundled seed data if the API is offline. */
    });
  }, [reloadProducts]);

  useEffect(() => {
    apiRequest<{ authenticated: boolean; user?: Omit<AppUser, "password">; csrfToken?: string }>(
      "/api/auth/session"
    )
      .then((session) => {
        if (session.authenticated && session.user && session.csrfToken) {
          setAdminSession({ user: session.user, csrfToken: session.csrfToken });
          setUser({ ...session.user, password: "" });
        } else if (user?.isAdmin) {
          setUser(null);
        }
      })
      .catch(() => {
        if (user?.isAdmin) setUser(null);
      });
  }, []);

  const setLang = useCallback((l: Lang) => setLangRaw(l), [setLangRaw]);

  const navigate = useCallback((p: Page, newParams: Record<string, string> = {}) => {
    setPage(p);
    setParams(newParams);
    window.scrollTo({ top: 0, behavior: "smooth" });

    const titles: Record<Page, string> = {
      home: "FRONTE PARTE — Bespoke Knitwear",
      shop: "Collection — FRONTE PARTE",
      product: "Product — FRONTE PARTE",
      archive: "Archive — FRONTE PARTE",
      soldOut: "Gone Pieces — FRONTE PARTE",
      cart: "Cart — FRONTE PARTE",
      checkout: "Checkout — FRONTE PARTE",
      auth: "Sign In — FRONTE PARTE",
      account: "My Account — FRONTE PARTE",
      admin: "Admin — FRONTE PARTE",
    };
    document.title = titles[p];
  }, []);

  const login = useCallback(
    async (loginStr: string, password: string): Promise<boolean> => {
      const normalizedLogin = loginStr.trim();
      const isAdminLogin =
        normalizedLogin === "FRONTE" || normalizedLogin === ADMIN_USER.email;

      if (isAdminLogin) {
        try {
          const result = await apiRequest<{
            user: Omit<AppUser, "password">;
            csrfToken: string;
          }>("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ login: normalizedLogin, password }),
          });
          setAdminSession({ user: result.user, csrfToken: result.csrfToken });
          setUser({ ...result.user, password: "" });
          await reloadProducts();
          return true;
        } catch {
          return false;
        }
      }

      const found = users.find(
        (u) => !u.isAdmin && (u.email === normalizedLogin || u.name === normalizedLogin) && u.password === password
      );
      if (found) {
        setUser(found);
        return true;
      }
      return false;
    },
    [users, setUser, reloadProducts]
  );

  const logout = useCallback(async () => {
    if (adminSession) {
      await apiRequest("/api/auth/logout", { method: "POST" }, adminSession.csrfToken).catch(
        () => undefined
      );
    }
    setAdminSession(null);
    setUser(null);
    navigate("home");
  }, [adminSession, setUser, navigate]);

  const register = useCallback(
    (email: string, password: string, name: string): boolean => {
      if (email === ADMIN_USER.email || name.trim() === "FRONTE") return false;
      if (users.find((u) => u.email === email)) return false;
      const newUser: AppUser = {
        id: `user_${Date.now()}`,
        email,
        password,
        name,
        isAdmin: false,
      };
      setUsers((prev) => [...prev, newUser]);
      setUser(newUser);
      return true;
    },
    [users, setUsers, setUser]
  );

  // Cart is keyed by userId for cross-device persistence
  const cart = useMemo<CartItem[]>(
    () => (user ? carts[user.id] || [] : []),
    [user, carts]
  );

  const addToCart = useCallback(
    (productId: string, size: string) => {
      if (!user) return;
      setCarts((prev) => {
        const userCart = prev[user.id] || [];
        const idx = userCart.findIndex((i) => i.productId === productId && i.size === size);
        const updated =
          idx >= 0
            ? userCart.map((i, n) =>
                n === idx ? { ...i, quantity: i.quantity + 1 } : i
              )
            : [...userCart, { productId, size, quantity: 1 }];
        return { ...prev, [user.id]: updated };
      });
    },
    [user, setCarts]
  );

  const removeFromCart = useCallback(
    (productId: string, size: string) => {
      if (!user) return;
      setCarts((prev) => ({
        ...prev,
        [user.id]: (prev[user.id] || []).filter(
          (i) => !(i.productId === productId && i.size === size)
        ),
      }));
    },
    [user, setCarts]
  );

  const updateQty = useCallback(
    (productId: string, size: string, qty: number) => {
      if (!user) return;
      setCarts((prev) => ({
        ...prev,
        [user.id]:
          qty <= 0
            ? (prev[user.id] || []).filter(
                (i) => !(i.productId === productId && i.size === size)
              )
            : (prev[user.id] || []).map((i) =>
                i.productId === productId && i.size === size ? { ...i, quantity: qty } : i
              ),
      }));
    },
    [user, setCarts]
  );

  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);

  const cartTotal = useMemo(
    () =>
      cart.reduce((sum, item) => {
        const p = products.find((p) => p.id === item.productId);
        return sum + (p?.price || 0) * item.quantity;
      }, 0),
    [cart, products]
  );

  const placeOrder = useCallback(
    (items: CartItem[], total: number, paymentMethod: string) => {
      if (!user) return;
      const order: Order = {
        id: `ORD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        userId: user.id,
        items,
        total,
        date: new Date().toISOString(),
        status: "pending",
        paymentMethod,
      };
      setOrders((prev) => [order, ...prev]);
      setCarts((prev) => ({ ...prev, [user.id]: [] }));
    },
    [user, setOrders, setCarts]
  );

  const logActivity = useCallback(
    (action: string, actionRu: string) => {
      const entry: AdminActivity = {
        id: `act_${Date.now()}`,
        action,
        actionRu,
        timestamp: new Date().toISOString(),
      };
      setActivity((prev) => [entry, ...prev.slice(0, 49)]);
    },
    [setActivity]
  );

  const saveAdminProduct = useCallback(
    async (product: Omit<Product, "id">, id?: string): Promise<Product> => {
      if (!adminSession) throw new Error("Admin session required");

      const saved = await apiRequest<Product>(
        id ? `/api/products/${encodeURIComponent(id)}` : "/api/products",
        {
          method: id ? "PUT" : "POST",
          body: JSON.stringify(product),
        },
        adminSession.csrfToken
      );

      setProducts((prev) =>
        id ? prev.map((p) => (p.id === id ? saved : p)) : [...prev, saved]
      );
      return saved;
    },
    [adminSession, setProducts]
  );

  const deleteAdminProduct = useCallback(
    async (id: string): Promise<void> => {
      if (!adminSession) throw new Error("Admin session required");

      await apiRequest(
        `/api/products/${encodeURIComponent(id)}`,
        { method: "DELETE" },
        adminSession.csrfToken
      );
      setProducts((prev) => prev.filter((p) => p.id !== id));
    },
    [adminSession, setProducts]
  );

  const setAdminProductStock = useCallback(
    async (id: string, inStock: boolean): Promise<Product> => {
      if (!adminSession) throw new Error("Admin session required");

      const updated = await apiRequest<Product>(
        `/api/products/${encodeURIComponent(id)}/stock`,
        {
          method: "PATCH",
          body: JSON.stringify({ inStock }),
        },
        adminSession.csrfToken
      );

      setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
      return updated;
    },
    [adminSession, setProducts]
  );

  // Filter orders per user (admin sees all)
  const isAdminAuthenticated = Boolean(adminSession);
  const visibleOrders = useMemo(
    () =>
      !user ? [] : isAdminAuthenticated ? orders : orders.filter((o) => o.userId === user.id),
    [user, orders, isAdminAuthenticated]
  );

  const value: AppCtx = {
    lang,
    setLang,
    T: translations[lang],
    page,
    navigate,
    params,
    user,
    isAdminAuthenticated,
    login,
    logout,
    register,
    products,
    setProducts,
    reloadProducts,
    saveAdminProduct,
    deleteAdminProduct,
    setAdminProductStock,
    cart,
    addToCart,
    removeFromCart,
    updateQty,
    cartCount,
    cartTotal,
    orders: visibleOrders,
    placeOrder,
    activity,
    logActivity,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ═══════════════════════════════════════════════════════════════
// LOGO
// ═══════════════════════════════════════════════════════════════

function FPMonogram({
  size = 36,
  variant = "light",
  className = "",
}: {
  size?: number;
  variant?: "light" | "dark";
  className?: string;
}) {
  const height = Math.round(size * 1.18);
  const src = variant === "dark" ? fpLogoDark : fpLogoLight;

  return (
    <img
      src={src}
      alt=""
      className={`block shrink-0 object-contain ${className}`}
      aria-hidden="true"
      draggable={false}
      style={{
        width: size,
        height,
        verticalAlign: "middle",
      }}
    />
  );
}

/** Brand mark for navigation bar */
function BrandMark({ inverted = false }: { inverted?: boolean }) {
  const { navigate } = useApp();
  const fg = inverted ? "#F8F5F0" : "#0D0D0D";

  return (
    <button
      onClick={() => navigate("home")}
      className="flex items-center cursor-pointer transition-opacity hover:opacity-70"
      aria-label="FRONTE PARTE — Home"
    >
      <div className="flex flex-col gap-1">
        <span
          className="block leading-none text-[24px] md:text-[26px]"
          style={{
            fontFamily: '"Bodoni Moda", Georgia, serif',
            fontWeight: 500,
            letterSpacing: 0,
            color: fg,
          }}
        >
          FRONTE PARTE
        </span>
        <span
          className="block leading-none text-[7.5px] opacity-45"
          style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300, letterSpacing: 0, color: fg }}
        >
          BESPOKE KNITWEAR
        </span>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// ICON HELPERS (Pinterest, Telegram, payment icons)
// ═══════════════════════════════════════════════════════════════

function PinterestIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
    </svg>
  );
}

function InstagramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TelegramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function PaymentIcon({ type, inverted = false }: { type: string; inverted?: boolean }) {
  const c = inverted ? "#F8F5F0" : "#0D0D0D";
  if (type === "apple")
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill={c}>
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
    );
  if (type === "google")
    return (
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path fill={inverted ? c : "#4285F4"} d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill={inverted ? c : "#34A853"} d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill={inverted ? c : "#FBBC05"} d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill={inverted ? c : "#EA4335"} d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    );
  if (type === "sbp")
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M2 7l10-5 10 5v10l-10 5L2 17V7z" stroke={c} strokeWidth="1.5" fill="none" />
        <circle cx="12" cy="12" r="2.5" fill={c} />
      </svg>
    );
  if (type === "crypto")
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill={c}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14v-4H7l5-8v4h4l-5 8z" />
      </svg>
    );
  // Default: card
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
      <rect x="2" y="5" width="20" height="14" rx="1" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════

function Nav() {
  const { T, lang, setLang, navigate, page, user, isAdminAuthenticated, cartCount } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const transparent = page === "home" && !scrolled && !menuOpen;
  const inv = false;

  const links = [
    { label: T.nav.shop, page: "shop" as Page },
    { label: T.nav.archive, page: "archive" as Page },
    { label: T.nav.soldOut, page: "soldOut" as Page },
    {
      label: T.nav.contact,
      page: "home" as Page,
      action: () => {
        navigate("home");
        setTimeout(
          () => document.getElementById("fp-contact")?.scrollIntoView({ behavior: "smooth" }),
          120
        );
      },
    },
  ];

  const linkClass = `text-[10px] tracking-[0.22em] font-normal transition-opacity duration-200 hover:opacity-50 ${
    inv ? "text-[#F8F5F0]" : "text-foreground"
  }`;

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        transparent ? "bg-transparent" : "bg-background/95 backdrop-blur-sm border-b border-border"
      }`}
    >
      <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 h-[68px] flex items-center justify-between relative">
        {/* Left links — desktop */}
        <nav className="hidden md:flex items-center gap-8 lg:gap-12">
          {links.map((l) => (
            <button
              key={l.label}
              onClick={l.action ?? (() => navigate(l.page))}
              className={linkClass}
              style={{ fontFamily: '"Jost", sans-serif' }}
            >
              {l.label}
            </button>
          ))}
        </nav>

        {/* Center brand */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <BrandMark inverted={inv} />
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-5 md:gap-7">
          <button
            onClick={() => setLang(lang === "en" ? "ru" : "en")}
            className={`hidden md:block text-[10px] tracking-[0.2em] transition-opacity hover:opacity-50 ${
              inv ? "text-[#F8F5F0]" : "text-foreground"
            }`}
            style={{ fontFamily: '"Jost", sans-serif' }}
            aria-label="Toggle language"
          >
            {T.nav.langToggle}
          </button>

          <button
            onClick={() =>
              navigate(isAdminAuthenticated ? "admin" : user ? "account" : "auth")
            }
            className={`transition-opacity hover:opacity-50 ${inv ? "text-[#F8F5F0]" : "text-foreground"}`}
            aria-label={T.nav.account}
          >
            <User size={17} strokeWidth={1.5} />
          </button>

          <button
            onClick={() => navigate("cart")}
            className={`relative transition-opacity hover:opacity-50 ${
              inv ? "text-[#F8F5F0]" : "text-foreground"
            }`}
            aria-label={T.nav.cart}
          >
            <ShoppingBag size={17} strokeWidth={1.5} />
            {cartCount > 0 && (
              <span
                className="absolute -top-1.5 -right-2 w-[18px] h-[18px] rounded-full bg-foreground text-background flex items-center justify-center text-[8px] leading-none"
                style={{ fontFamily: '"Jost", sans-serif' }}
              >
                {cartCount}
              </span>
            )}
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className={`md:hidden transition-opacity hover:opacity-50 ${
              inv ? "text-[#F8F5F0]" : "text-foreground"
            }`}
            aria-label="Menu"
          >
            {menuOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden bg-background border-t border-border">
          <div className="px-6 py-10 flex flex-col gap-7">
            {links.map((l) => (
              <button
                key={l.label}
                onClick={() => {
                  if (l.action) l.action();
                  else navigate(l.page);
                  setMenuOpen(false);
                }}
                className="text-left text-[11px] tracking-[0.22em] text-foreground hover:opacity-50 transition-opacity"
                style={{ fontFamily: '"Jost", sans-serif' }}
              >
                {l.label}
              </button>
            ))}
            <div className="pt-5 border-t border-border flex justify-between">
              <button
                onClick={() => {
                  navigate(isAdminAuthenticated ? "admin" : user ? "account" : "auth");
                  setMenuOpen(false);
                }}
                className="text-[11px] tracking-[0.2em] text-foreground/60 hover:text-foreground transition-colors"
                style={{ fontFamily: '"Jost", sans-serif' }}
              >
                {T.nav.account}
              </button>
              <button
                onClick={() => setLang(lang === "en" ? "ru" : "en")}
                className="text-[11px] tracking-[0.2em] text-foreground/60 hover:text-foreground transition-colors"
                style={{ fontFamily: '"Jost", sans-serif' }}
              >
                {T.nav.langToggle}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════════════

function Footer() {
  const { T, navigate } = useApp();
  const footerLinks = [
    { label: T.nav.shop, page: "shop" as Page },
    { label: T.nav.archive, page: "archive" as Page },
    { label: T.nav.soldOut, page: "soldOut" as Page },
  ];

  return (
    <footer id="fp-contact" className="bg-foreground text-[#F8F5F0] pt-20 pb-10">
      <div className="max-w-screen-xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-14 mb-16">
          {/* Brand */}
          <div>
            <FPMonogram size={44} variant="dark" className="mb-5" />
            <p
              className="text-[9px] tracking-[0.28em] opacity-50 mt-2 leading-relaxed"
              style={{ fontFamily: '"Jost", sans-serif' }}
            >
              FRONTE PARTE
              <br />
              <span className="opacity-70">{T.footer.made}</span>
            </p>
          </div>

          {/* Contact */}
          <div>
            <h3
              className="text-[9px] tracking-[0.22em] opacity-40 mb-5"
              style={{ fontFamily: '"Jost", sans-serif' }}
            >
              {T.footer.contactTitle}
            </h3>
            <a
              href="mailto:hello@fronteparte.com"
              className="block text-sm opacity-70 hover:opacity-100 transition-opacity mb-2"
              style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
            >
              {T.footer.email}
            </a>
            <a
              href="tel:+79152660705"
              className="block text-sm opacity-70 hover:opacity-100 transition-opacity"
              style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
            >
              {T.footer.phone}
            </a>
          </div>

          {/* Social */}
          <div>
            <h3
              className="text-[9px] tracking-[0.22em] opacity-40 mb-5"
              style={{ fontFamily: '"Jost", sans-serif' }}
            >
              {T.footer.followTitle}
            </h3>
            <a
              href="https://ru.pinterest.com/fronteparte/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-sm opacity-70 hover:opacity-100 transition-opacity mb-3"
              style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
            >
              <PinterestIcon size={15} />
              Pinterest
            </a>
            <a
              href="https://www.instagram.com/fronteparte/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-sm opacity-70 hover:opacity-100 transition-opacity mb-3"
              style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
            >
              <InstagramIcon size={15} />
              Instagram
            </a>
            <a
              href="https://t.me/fronteparte"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-sm opacity-70 hover:opacity-100 transition-opacity"
              style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
            >
              <TelegramIcon size={15} />
              Telegram
            </a>
          </div>
        </div>

        <div className="pt-7 border-t border-[rgba(248,245,240,0.1)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p
            className="text-[9px] tracking-[0.15em] opacity-30"
            style={{ fontFamily: '"Jost", sans-serif' }}
          >
            {T.footer.rights}
          </p>
          <div className="flex gap-8">
            {footerLinks.map((l) => (
              <button
                key={l.page}
                onClick={() => navigate(l.page)}
                className="text-[9px] tracking-[0.15em] opacity-30 hover:opacity-60 transition-opacity"
                style={{ fontFamily: '"Jost", sans-serif' }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

// ═══════════════════════════════════════════════════════════════
// PRODUCT CARD (shared between Home + Shop)
// ═══════════════════════════════════════════════════════════════

function ProductCard({ product }: { product: Product }) {
  const { T, navigate, addToCart, user, lang } = useApp();
  const [hovered, setHovered] = useState(false);
  const name = lang === "en" ? product.name : product.nameRu;

  return (
    <article
      className="group cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image */}
      <div
        className="relative overflow-hidden bg-secondary mb-4"
        style={{ paddingBottom: "133%" }}
        onClick={() => navigate("product", { productId: product.id })}
      >
        <img
          src={
            hovered && product.images.length > 1 ? product.images[1] : product.images[0]
          }
          alt={name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          loading="lazy"
        />
        {!product.inStock && (
          <div
            className="absolute top-4 left-4 text-[8px] tracking-[0.2em] bg-background text-foreground px-3 py-1"
            style={{ fontFamily: '"Jost", sans-serif' }}
          >
            {T.shop.soldOut}
          </div>
        )}
      </div>

      {/* Caption */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3
            className="text-sm italic text-foreground mb-0.5"
            style={{ fontFamily: '"Bodoni Moda", Georgia, serif' }}
          >
            {name}
          </h3>
          <p
            className="text-[11px] tracking-[0.1em] text-foreground/55"
            style={{ fontFamily: '"Jost", sans-serif' }}
          >
            {product.price.toLocaleString("ru-RU")} ₽
          </p>
        </div>
        {product.inStock && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!user) { navigate("auth"); return; }
              addToCart(product.id, product.sizes[0]);
            }}
            className="shrink-0 text-[8px] tracking-[0.18em] border border-foreground/20 px-3 py-2 hover:bg-foreground hover:text-background transition-all duration-200 opacity-0 group-hover:opacity-100"
            style={{ fontFamily: '"Jost", sans-serif' }}
          >
            {T.shop.addToCart.toUpperCase()}
          </button>
        )}
      </div>
    </article>
  );
}

// ═══════════════════════════════════════════════════════════════
// HOME PAGE
// ═══════════════════════════════════════════════════════════════

function HomePage() {
  const { T, navigate, products, lang } = useApp();
  const featured = products.filter((p) => p.featured && p.inStock).slice(0, 3);
  const marquee = T.home.marquee.repeat(6);

  return (
    <main>
      {/* ── Hero ── */}
      <section className="relative h-screen flex items-end overflow-hidden" aria-label="Hero">
        <img
          src={heroWoolStillLife}
          alt="Wool sheep figurines with yarn balls and knitting needles"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

        <div className="relative z-10 w-full max-w-screen-xl mx-auto px-6 pb-24">
          <p
            className="text-[9px] tracking-[0.35em] text-[rgba(248,245,240,0.55)] mb-5 animate-fade-in-up"
            style={{ fontFamily: '"Jost", sans-serif' }}
          >
            {lang === "en" ? "BESPOKE · HANDMADE" : "БЕСПОК · РУЧНАЯ РАБОТА"}
          </p>
          <h1
            className="text-5xl md:text-7xl lg:text-8xl italic text-[#F8F5F0] mb-6 leading-[0.92] animate-fade-in-up"
            style={{
              fontFamily: '"Bodoni Moda", Georgia, serif',
              fontWeight: 400,
              animationDelay: "0.1s",
            }}
          >
            {T.home.hero}
          </h1>
          <p
            className="text-sm text-[rgba(248,245,240,0.65)] mb-12 tracking-[0.08em] animate-fade-in-up"
            style={{
              fontFamily: '"Jost", sans-serif',
              fontWeight: 300,
              animationDelay: "0.2s",
            }}
          >
            {T.home.heroSub}
          </p>
          <button
            onClick={() => navigate("shop")}
            className="group inline-flex items-center gap-4 text-[10px] tracking-[0.22em] text-[#F8F5F0] border border-[rgba(248,245,240,0.35)] px-10 py-5 hover:bg-[#F8F5F0] hover:text-foreground transition-all duration-400 animate-fade-in-up"
            style={{
              fontFamily: '"Jost", sans-serif',
              animationDelay: "0.3s",
            }}
          >
            {T.home.heroBtn}
            <ArrowRight
              size={13}
              className="group-hover:translate-x-1.5 transition-transform duration-300"
            />
          </button>
        </div>
      </section>

      {/* ── Marquee ticker ── */}
      <div className="bg-foreground py-[14px] overflow-hidden" aria-hidden="true">
        <div className="flex whitespace-nowrap animate-marquee">
          <span
            className="text-[#F8F5F0] text-[9px] tracking-[0.28em] opacity-55 shrink-0"
            style={{ fontFamily: '"Jost", sans-serif' }}
          >
            {marquee}
          </span>
          <span
            className="text-[#F8F5F0] text-[9px] tracking-[0.28em] opacity-55 shrink-0"
            style={{ fontFamily: '"Jost", sans-serif' }}
          >
            {marquee}
          </span>
        </div>
      </div>

      {/* ── Featured products ── */}
      <section className="max-w-screen-xl mx-auto px-6 py-24">
        <div className="flex items-end justify-between mb-14">
          <h2
            className="text-4xl md:text-5xl italic text-foreground"
            style={{ fontFamily: '"Bodoni Moda", Georgia, serif', fontWeight: 400 }}
          >
            {T.home.featuredTitle}
          </h2>
          <button
            onClick={() => navigate("shop")}
            className="flex items-center gap-2 text-[9px] tracking-[0.22em] text-foreground/50 hover:text-foreground transition-colors"
            style={{ fontFamily: '"Jost", sans-serif' }}
          >
            {T.home.featuredAll}
            <ArrowRight size={11} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* ── Editorial story ── */}
      <section className="bg-secondary">
        <div className="max-w-screen-xl mx-auto px-6 py-24 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <p
              className="text-[9px] tracking-[0.22em] text-foreground/40 mb-7"
              style={{ fontFamily: '"Jost", sans-serif' }}
            >
              {T.home.storyLabel}
            </p>
            <h2
              className="text-4xl md:text-5xl italic text-foreground mb-8 leading-[1.05]"
              style={{ fontFamily: '"Bodoni Moda", Georgia, serif', fontWeight: 400 }}
            >
              {T.home.storyTitle}
            </h2>
            <p
              className="text-[15px] text-foreground/65 leading-relaxed mb-10"
              style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
            >
              {T.home.storyText}
            </p>
            <button
              onClick={() => navigate("archive")}
              className="group inline-flex items-center gap-3 text-[9px] tracking-[0.22em] text-foreground border-b border-foreground/30 pb-1 hover:border-foreground transition-colors"
              style={{ fontFamily: '"Jost", sans-serif' }}
            >
              {T.home.storyBtn}
              <ArrowRight
                size={11}
                className="group-hover:translate-x-1 transition-transform duration-300"
              />
            </button>
          </div>
          <div className="relative overflow-hidden h-96 md:h-[540px]">
            <img
              src="https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=800&h=1000&fit=crop&auto=format"
              alt="Handmade knitwear process — close-up of yarn and needles"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════
// SHOP PAGE
// ═══════════════════════════════════════════════════════════════

function ShopPage() {
  const { T, products, lang } = useApp();
  const [cat, setCat] = useState("all");
  const availableProducts = products.filter((p) => p.inStock);

  const catMap: Record<string, string> = {
    all: T.shop.all,
    tops: T.shop.tops,
    outerwear: T.shop.outerwear,
    dresses: T.shop.dresses,
    accessories: T.shop.accessories,
  };

  const allCats = ["all", ...Array.from(new Set(availableProducts.map((p) => p.category)))];
  const visible =
    cat === "all"
      ? availableProducts
      : availableProducts.filter((p) => p.category === cat);

  return (
    <main className="pt-16">
      <div className="max-w-screen-xl mx-auto px-6 py-16">
        <h1
          className="text-5xl md:text-7xl italic text-foreground mb-14"
          style={{ fontFamily: '"Bodoni Moda", Georgia, serif', fontWeight: 400 }}
        >
          {T.shop.title}
        </h1>

        {/* Category tabs */}
        <div className="flex gap-0 border-b border-border mb-14 overflow-x-auto">
          {allCats.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`text-[9px] tracking-[0.22em] px-5 py-3 border-b-[1.5px] transition-all whitespace-nowrap ${
                cat === c
                  ? "border-foreground text-foreground"
                  : "border-transparent text-foreground/35 hover:text-foreground/65"
              }`}
              style={{ fontFamily: '"Jost", sans-serif', marginBottom: -1 }}
            >
              {(catMap[c] || c).toUpperCase()}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
      <Footer />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════
// SOLD OUT PAGE
// ═══════════════════════════════════════════════════════════════

function SoldOutPage() {
  const { T, products, navigate } = useApp();
  const gonePieces = products.filter((p) => !p.inStock);

  return (
    <main className="pt-16">
      <div className="max-w-screen-xl mx-auto px-6 py-16">
        <div className="mb-14">
          <h1
            className="text-5xl md:text-7xl italic text-foreground mb-4"
            style={{ fontFamily: '"Bodoni Moda", Georgia, serif', fontWeight: 400 }}
          >
            {T.soldOut.title}
          </h1>
          <p
            className="text-sm text-foreground/45"
            style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
          >
            {T.soldOut.subtitle}
          </p>
        </div>

        {gonePieces.length === 0 ? (
          <div className="border-y border-border py-16 text-center">
            <p
              className="text-sm text-foreground/35 mb-8"
              style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
            >
              {T.soldOut.empty}
            </p>
            <button
              onClick={() => navigate("shop")}
              className="text-[9px] tracking-[0.22em] border border-foreground px-10 py-4 hover:bg-foreground hover:text-background transition-all"
              style={{ fontFamily: '"Jost", sans-serif' }}
            >
              {T.soldOut.emptyBtn.toUpperCase()}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
            {gonePieces.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════
// PRODUCT DETAIL PAGE
// ═══════════════════════════════════════════════════════════════

function ProductPage() {
  const { T, products, navigate, addToCart, user, params, lang } = useApp();
  const [selectedSize, setSelectedSize] = useState("");
  const [activeImg, setActiveImg] = useState(0);
  const [justAdded, setJustAdded] = useState(false);

  const product = products.find((p) => p.id === params.productId);

  useEffect(() => {
    if (product) setSelectedSize(product.sizes[0] || "");
    setActiveImg(0);
  }, [params.productId]);

  if (!product)
    return (
      <div className="pt-40 text-center">
        <button
          onClick={() => navigate("shop")}
          className="text-sm underline"
          style={{ fontFamily: '"Jost", sans-serif' }}
        >
          {T.product.back}
        </button>
      </div>
    );

  const name = lang === "en" ? product.name : product.nameRu;
  const desc = lang === "en" ? product.description : product.descriptionRu;

  const handleAdd = () => {
    if (!user) { navigate("auth"); return; }
    if (!selectedSize) return;
    addToCart(product.id, selectedSize);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2400);
  };

  return (
    <main className="pt-16">
      <div className="max-w-screen-xl mx-auto px-6 py-14">
        <button
          onClick={() => navigate("shop")}
          className="text-[9px] tracking-[0.2em] text-foreground/40 hover:text-foreground transition-colors mb-12 flex items-center gap-2"
          style={{ fontFamily: '"Jost", sans-serif' }}
        >
          ← {T.product.back}
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 lg:gap-24">
          {/* Image gallery */}
          <div>
            <div
              className="relative overflow-hidden bg-secondary mb-3"
              style={{ paddingBottom: "133%" }}
            >
              <img
                src={product.images[activeImg]}
                alt={name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-3">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={`relative overflow-hidden bg-secondary transition-opacity ${
                      activeImg === i ? "ring-1 ring-foreground/40" : "opacity-45 hover:opacity-70"
                    }`}
                    style={{ width: 64, paddingBottom: 85 }}
                    aria-label={`Image ${i + 1}`}
                  >
                    <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product details */}
          <div className="flex flex-col justify-center">
            <p
              className="text-[9px] tracking-[0.22em] text-foreground/40 mb-3"
              style={{ fontFamily: '"Jost", sans-serif' }}
            >
              {product.category.toUpperCase()}
            </p>
            <h1
              className="text-4xl md:text-5xl italic text-foreground mb-4 leading-[1.05]"
              style={{ fontFamily: '"Bodoni Moda", Georgia, serif', fontWeight: 400 }}
            >
              {name}
            </h1>
            <p
              className="text-2xl text-foreground mb-10"
              style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
            >
              {product.price.toLocaleString("ru-RU")} ₽
            </p>

            {/* Sizes */}
            {product.inStock && (
              <div className="mb-8">
                <p
                  className="text-[9px] tracking-[0.2em] text-foreground/50 mb-3"
                  style={{ fontFamily: '"Jost", sans-serif' }}
                >
                  {T.product.size}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {product.sizes.map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setSelectedSize(sz)}
                      className={`w-12 h-12 text-xs border transition-all duration-150 ${
                        selectedSize === sz
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-foreground hover:border-foreground/50"
                      }`}
                      style={{ fontFamily: '"Jost", sans-serif' }}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add to cart button */}
            <button
              onClick={handleAdd}
              disabled={!product.inStock}
              className={`w-full py-[18px] text-[10px] tracking-[0.22em] transition-all duration-300 mb-3 ${
                !product.inStock
                  ? "bg-muted text-foreground/30 cursor-not-allowed"
                  : justAdded
                  ? "bg-foreground/75 text-background"
                  : "bg-foreground text-background hover:bg-foreground/80"
              }`}
              style={{ fontFamily: '"Jost", sans-serif' }}
            >
              {!product.inStock
                ? T.product.soldOut.toUpperCase()
                : justAdded
                ? `✓ ${T.product.added.toUpperCase()}`
                : T.product.addToCart.toUpperCase()}
            </button>

            <p
              className="text-[9px] tracking-[0.1em] text-foreground/35 text-center mb-12"
              style={{ fontFamily: '"Jost", sans-serif' }}
            >
              {T.product.shipping}
            </p>

            {/* Description */}
            <div>
              <p
                className="text-[9px] tracking-[0.2em] text-foreground/45 mb-4"
                style={{ fontFamily: '"Jost", sans-serif' }}
              >
                {T.product.description}
              </p>
              <p
                className="text-[15px] text-foreground/65 leading-relaxed"
                style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
              >
                {desc}
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════
// ARCHIVE PAGE
// ═══════════════════════════════════════════════════════════════

function ArchivePage() {
  const { T } = useApp();

  const gridClass = (count: number) => {
    if (count === 1) return "grid-cols-1 max-w-[760px] mx-auto";
    if (count === 2) return "grid-cols-1 md:grid-cols-2";
    if (count === 3) return "grid-cols-1 md:grid-cols-3";
    return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  };

  return (
    <main className="pt-16">
      <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 py-16">
        <div className="mb-14 max-w-screen-xl mx-auto">
          <h1
            className="text-5xl md:text-7xl italic text-foreground mb-4"
            style={{ fontFamily: '"Bodoni Moda", Georgia, serif', fontWeight: 400 }}
          >
            {T.archive.title}
          </h1>
          <p
            className="text-sm text-foreground/45"
            style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
          >
            {T.archive.subtitle}
          </p>
        </div>

        <div className="max-w-screen-xl mx-auto space-y-5 md:space-y-7">
          {ARCHIVE_GROUPS.map((group, groupIndex) => (
            <section key={groupIndex} className={`grid ${gridClass(group.length)} items-start gap-5 md:gap-6`}>
              {group.map((image, imageIndex) => (
                <figure key={`${groupIndex}-${imageIndex}`} className="m-0 self-start">
                  <img
                    src={image}
                    alt=""
                    className="block w-full h-auto"
                    loading="lazy"
                  />
                </figure>
              ))}
            </section>
          ))}
        </div>
      </div>
      <Footer />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════
// CART PAGE
// ═══════════════════════════════════════════════════════════════

function CartPage() {
  const { T, cart, products, removeFromCart, updateQty, navigate, cartTotal, lang } = useApp();

  if (cart.length === 0)
    return (
      <main className="pt-16 min-h-screen flex flex-col items-center justify-center px-6">
        <h1
          className="text-4xl italic text-foreground mb-4"
          style={{ fontFamily: '"Bodoni Moda", Georgia, serif', fontWeight: 400 }}
        >
          {T.cart.title}
        </h1>
        <p
          className="text-sm text-foreground/45 mb-10"
          style={{ fontFamily: '"Jost", sans-serif' }}
        >
          {T.cart.empty}
        </p>
        <button
          onClick={() => navigate("shop")}
          className="text-[9px] tracking-[0.22em] border border-foreground px-10 py-4 hover:bg-foreground hover:text-background transition-all"
          style={{ fontFamily: '"Jost", sans-serif' }}
        >
          {T.cart.emptyBtn.toUpperCase()}
        </button>
      </main>
    );

  return (
    <main className="pt-16">
      <div className="max-w-screen-xl mx-auto px-6 py-16">
        <h1
          className="text-5xl italic text-foreground mb-16"
          style={{ fontFamily: '"Bodoni Moda", Georgia, serif', fontWeight: 400 }}
        >
          {T.cart.title}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          {/* Items */}
          <div className="lg:col-span-2">
            {cart.map((item) => {
              const p = products.find((x) => x.id === item.productId);
              if (!p) return null;
              const name = lang === "en" ? p.name : p.nameRu;

              return (
                <div
                  key={`${item.productId}-${item.size}`}
                  className="flex gap-6 py-7 border-b border-border"
                >
                  <div
                    className="relative bg-secondary overflow-hidden shrink-0 cursor-pointer"
                    style={{ width: 96, paddingBottom: 128 }}
                    onClick={() => navigate("product", { productId: p.id })}
                  >
                    <img
                      src={p.images[0]}
                      alt={name}
                      className="absolute inset-0 w-full h-full object-cover hover:opacity-90 transition-opacity"
                    />
                  </div>

                  <div className="flex-1 flex flex-col justify-between py-1">
                    <div>
                      <h3
                        className="text-base italic text-foreground mb-1"
                        style={{ fontFamily: '"Bodoni Moda", Georgia, serif' }}
                      >
                        {name}
                      </h3>
                      <p
                        className="text-[9px] tracking-[0.18em] text-foreground/45"
                        style={{ fontFamily: '"Jost", sans-serif' }}
                      >
                        {T.cart.size}: {item.size}
                      </p>
                    </div>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      {/* Qty controls */}
                      <div className="flex items-center border border-border">
                        <button
                          onClick={() => updateQty(item.productId, item.size, item.quantity - 1)}
                          className="w-9 h-9 flex items-center justify-center hover:bg-secondary transition-colors"
                        >
                          <Minus size={11} strokeWidth={1.5} />
                        </button>
                        <span
                          className="w-9 text-center text-sm"
                          style={{ fontFamily: '"Jost", sans-serif' }}
                        >
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQty(item.productId, item.size, item.quantity + 1)}
                          className="w-9 h-9 flex items-center justify-center hover:bg-secondary transition-colors"
                        >
                          <Plus size={11} strokeWidth={1.5} />
                        </button>
                      </div>

                      <span
                        className="text-sm text-foreground"
                        style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
                      >
                        {(p.price * item.quantity).toLocaleString("ru-RU")} ₽
                      </span>

                      <button
                        onClick={() => removeFromCart(item.productId, item.size)}
                        className="text-[8px] tracking-[0.18em] text-foreground/35 hover:text-foreground transition-colors"
                        style={{ fontFamily: '"Jost", sans-serif' }}
                      >
                        {T.cart.remove}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary sidebar */}
          <div className="bg-secondary p-8 h-fit">
            <div className="flex justify-between mb-6 pb-6 border-b border-border">
              <span
                className="text-[9px] tracking-[0.22em] text-foreground/55"
                style={{ fontFamily: '"Jost", sans-serif' }}
              >
                {T.cart.total}
              </span>
              <span
                className="text-base text-foreground"
                style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
              >
                {cartTotal.toLocaleString("ru-RU")} ₽
              </span>
            </div>
            <button
              onClick={() => navigate("checkout")}
              className="w-full py-4 bg-foreground text-background text-[10px] tracking-[0.22em] hover:bg-foreground/80 transition-colors"
              style={{ fontFamily: '"Jost", sans-serif' }}
            >
              {T.cart.checkout.toUpperCase()}
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════
// CHECKOUT PAGE
// ═══════════════════════════════════════════════════════════════

function CheckoutPage() {
  const { T, cart, products, navigate, cartTotal, placeOrder, lang } = useApp();
  const [selectedPay, setSelectedPay] = useState("");
  const [done, setDone] = useState(false);
  const [orderId, setOrderId] = useState("");

  const handlePlace = () => {
    if (!selectedPay || cart.length === 0) return;
    const id = `ORD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    setOrderId(id);
    placeOrder(cart, cartTotal, selectedPay);
    setDone(true);
  };

  if (done)
    return (
      <main className="pt-16 min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 border border-foreground/20 flex items-center justify-center mx-auto mb-8">
            <Check size={22} strokeWidth={1.5} />
          </div>
          <h1
            className="text-4xl italic text-foreground mb-4"
            style={{ fontFamily: '"Bodoni Moda", Georgia, serif', fontWeight: 400 }}
          >
            {T.checkout.orderPlaced}
          </h1>
          <p
            className="text-sm text-foreground/55 mb-2"
            style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
          >
            {T.checkout.thankYou}
          </p>
          <p
            className="text-[9px] tracking-[0.18em] text-foreground/35 mb-10"
            style={{ fontFamily: '"Jost", sans-serif' }}
          >
            {T.checkout.orderRef} #{orderId}
          </p>
          <button
            onClick={() => navigate("home")}
            className="text-[9px] tracking-[0.22em] border border-foreground px-10 py-4 hover:bg-foreground hover:text-background transition-all"
            style={{ fontFamily: '"Jost", sans-serif' }}
          >
            {T.checkout.returnHome}
          </button>
        </div>
      </main>
    );

  return (
    <main className="pt-16">
      <div className="max-w-screen-xl mx-auto px-6 py-16">
        <h1
          className="text-5xl italic text-foreground mb-16"
          style={{ fontFamily: '"Bodoni Moda", Georgia, serif', fontWeight: 400 }}
        >
          {T.checkout.title}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Payment methods */}
          <div>
            <p
              className="text-[9px] tracking-[0.22em] text-foreground/45 mb-6"
              style={{ fontFamily: '"Jost", sans-serif' }}
            >
              {T.checkout.paymentTitle}
            </p>
            <div className="space-y-px">
              {PAYMENT_METHODS.map((m) => {
                const label = T.payment[m.labelKey];
                const sel = selectedPay === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedPay(m.id)}
                    className={`w-full flex items-center gap-4 px-5 py-4 border text-left transition-all duration-150 ${
                      sel
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background hover:border-foreground/30"
                    }`}
                  >
                    <PaymentIcon type={m.icon} inverted={sel} />
                    <span
                      className="flex-1 text-[13px]"
                      style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
                    >
                      {label}
                    </span>
                    <span
                      className={`text-[9px] tracking-[0.1em] ${sel ? "opacity-55" : "text-foreground/35"}`}
                      style={{ fontFamily: '"Jost", sans-serif' }}
                    >
                      {m.currency}
                    </span>
                    {sel && <Check size={13} strokeWidth={2} className="opacity-80" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Order summary */}
          <div>
            <p
              className="text-[9px] tracking-[0.22em] text-foreground/45 mb-6"
              style={{ fontFamily: '"Jost", sans-serif' }}
            >
              {T.checkout.summary}
            </p>
            <div className="bg-secondary p-7 mb-6">
              <div className="space-y-4 mb-6">
                {cart.map((item) => {
                  const p = products.find((x) => x.id === item.productId);
                  if (!p) return null;
                  const name = lang === "en" ? p.name : p.nameRu;
                  return (
                    <div key={`${item.productId}-${item.size}`} className="flex justify-between gap-4">
                      <span
                        className="text-sm italic text-foreground/70"
                        style={{ fontFamily: '"Bodoni Moda", Georgia, serif' }}
                      >
                        {name}
                        <span className="not-italic text-foreground/40 text-xs ml-1.5">
                          ×{item.quantity} / {item.size}
                        </span>
                      </span>
                      <span
                        className="text-sm text-foreground shrink-0"
                        style={{ fontFamily: '"Jost", sans-serif' }}
                      >
                        {(p.price * item.quantity).toLocaleString("ru-RU")} ₽
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between pt-4 border-t border-border">
                <span
                  className="text-[9px] tracking-[0.22em] text-foreground/55"
                  style={{ fontFamily: '"Jost", sans-serif' }}
                >
                  {T.cart.total}
                </span>
                <span
                  className="text-base text-foreground"
                  style={{ fontFamily: '"Jost", sans-serif' }}
                >
                  {cartTotal.toLocaleString("ru-RU")} ₽
                </span>
              </div>
            </div>
            <button
              onClick={handlePlace}
              disabled={!selectedPay}
              className={`w-full py-4 text-[10px] tracking-[0.22em] transition-all ${
                !selectedPay
                  ? "bg-muted text-foreground/25 cursor-not-allowed"
                  : "bg-foreground text-background hover:bg-foreground/80"
              }`}
              style={{ fontFamily: '"Jost", sans-serif' }}
            >
              {T.checkout.placeOrder.toUpperCase()}
            </button>
            <p
              className="text-[8px] tracking-[0.1em] text-foreground/30 text-center mt-4"
              style={{ fontFamily: '"Jost", sans-serif' }}
            >
              {T.checkout.paymentNote}
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════
// AUTH PAGE (Login / Register)
// ═══════════════════════════════════════════════════════════════

function AuthPage() {
  const { T, login, register, navigate, user, isAdminAuthenticated } = useApp();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fields, setFields] = useState({ login: "", email: "", password: "", name: "" });
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Redirect when already authenticated
  useEffect(() => {
    if (isAdminAuthenticated) navigate("admin");
    else if (user && !user.isAdmin) navigate("account");
  }, [user, isAdminAuthenticated]);

  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setSubmitting(true);
    if (mode === "login") {
      const ok = await login(fields.login, fields.password);
      if (!ok) setErr(T.auth.error);
    } else {
      if (!fields.name || !fields.email || !fields.password) {
        setSubmitting(false);
        return;
      }
      if (!register(fields.email, fields.password, fields.name)) setErr(T.auth.error);
    }
    setSubmitting(false);
  };

  const inputClass =
    "w-full bg-secondary border border-border px-4 py-3 text-[14px] text-foreground focus:border-foreground/60 outline-none transition-colors";

  return (
    <main className="pt-16 min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-xs">
        <h1
          className="text-4xl italic text-foreground mb-2 text-center"
          style={{ fontFamily: '"Bodoni Moda", Georgia, serif', fontWeight: 400 }}
        >
          {mode === "login" ? T.auth.signIn : T.auth.createAccount}
        </h1>
        <p
          className="text-[9px] tracking-[0.28em] text-foreground/35 text-center mb-10"
          style={{ fontFamily: '"Jost", sans-serif' }}
        >
          FRONTE PARTE
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-[8.5px] tracking-[0.18em] text-foreground/50 mb-1.5"
                style={{ fontFamily: '"Jost", sans-serif' }}>
                {T.auth.name}
              </label>
              <input
                type="text"
                value={fields.name}
                onChange={set("name")}
                className={inputClass}
                style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
                required
              />
            </div>
          )}
          <div>
            <label className="block text-[8.5px] tracking-[0.18em] text-foreground/50 mb-1.5"
              style={{ fontFamily: '"Jost", sans-serif' }}>
              {mode === "login" ? T.auth.loginLabel : T.auth.email}
            </label>
            <input
              type={mode === "register" ? "email" : "text"}
              value={mode === "login" ? fields.login : fields.email}
              onChange={mode === "login" ? set("login") : set("email")}
              className={inputClass}
              style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
              required
            />
          </div>
          <div>
            <label className="block text-[8.5px] tracking-[0.18em] text-foreground/50 mb-1.5"
              style={{ fontFamily: '"Jost", sans-serif' }}>
              {T.auth.password}
            </label>
            <input
              type="password"
              value={fields.password}
              onChange={set("password")}
              className={inputClass}
              style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
              required
            />
          </div>

          {err && (
            <p className="text-destructive text-xs text-center" style={{ fontFamily: '"Jost", sans-serif' }}>
              {err}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-4 text-background text-[10px] tracking-[0.22em] transition-colors mt-1 ${
              submitting ? "bg-foreground/55 cursor-wait" : "bg-foreground hover:bg-foreground/80"
            }`}
            style={{ fontFamily: '"Jost", sans-serif' }}
          >
            {mode === "login" ? T.auth.signInBtn : T.auth.createBtn}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }}
          className="w-full text-center text-[9px] tracking-[0.12em] text-foreground/38 hover:text-foreground/60 transition-colors mt-6"
          style={{ fontFamily: '"Jost", sans-serif' }}
        >
          {mode === "login" ? T.auth.toRegister : T.auth.toLogin}
        </button>
      </div>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════
// ACCOUNT PAGE
// ═══════════════════════════════════════════════════════════════

function AccountPage() {
  const { T, user, logout, navigate, orders, cart, products, lang } = useApp();

  useEffect(() => {
    if (!user) navigate("auth");
  }, [user]);

  if (!user) return null;

  const statusClass = "text-[8.5px] tracking-[0.15em] border border-foreground/18 px-3 py-1 text-foreground/50";

  return (
    <main className="pt-16">
      <div className="max-w-screen-xl mx-auto px-6 py-16">
        <div className="flex items-end justify-between mb-16 flex-wrap gap-4">
          <div>
            <h1
              className="text-5xl italic text-foreground mb-2"
              style={{ fontFamily: '"Bodoni Moda", Georgia, serif', fontWeight: 400 }}
            >
              {T.account.title}
            </h1>
            <p
              className="text-sm text-foreground/45"
              style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
            >
              {user.name} · {user.email}
            </p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-[9px] tracking-[0.18em] text-foreground/40 hover:text-foreground transition-colors"
            style={{ fontFamily: '"Jost", sans-serif' }}
          >
            <LogOut size={13} strokeWidth={1.5} />
            {T.account.signOut}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          {/* Cart preview */}
          <div>
            <h2
              className="text-[9px] tracking-[0.22em] text-foreground/40 mb-6"
              style={{ fontFamily: '"Jost", sans-serif' }}
            >
              {T.account.cartSection}
            </h2>
            {cart.length === 0 ? (
              <p
                className="text-sm text-foreground/30"
                style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
              >
                {T.account.emptyCart}
              </p>
            ) : (
              <>
                <div className="space-y-5 mb-5">
                  {cart.map((item) => {
                    const p = products.find((x) => x.id === item.productId);
                    if (!p) return null;
                    return (
                      <div key={`${item.productId}-${item.size}`} className="flex gap-3 items-start">
                        <div className="w-12 h-[64px] bg-secondary overflow-hidden shrink-0">
                          <img
                            src={p.images[0]}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p
                            className="text-sm italic text-foreground"
                            style={{ fontFamily: '"Bodoni Moda", Georgia, serif' }}
                          >
                            {lang === "en" ? p.name : p.nameRu}
                          </p>
                          <p
                            className="text-[9px] text-foreground/40"
                            style={{ fontFamily: '"Jost", sans-serif' }}
                          >
                            {item.size} · ×{item.quantity}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => navigate("cart")}
                  className="text-[9px] tracking-[0.18em] text-foreground border-b border-foreground/25 pb-0.5 hover:border-foreground transition-colors"
                  style={{ fontFamily: '"Jost", sans-serif' }}
                >
                  {T.account.viewCart}
                </button>
              </>
            )}
          </div>

          {/* Order history */}
          <div className="lg:col-span-2">
            <h2
              className="text-[9px] tracking-[0.22em] text-foreground/40 mb-6"
              style={{ fontFamily: '"Jost", sans-serif' }}
            >
              {T.account.orders}
            </h2>
            {orders.length === 0 ? (
              <p
                className="text-sm text-foreground/30"
                style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
              >
                {T.account.noOrders}
              </p>
            ) : (
              <div className="space-y-px">
                {orders.map((order) => (
                  <div key={order.id} className="bg-secondary p-6">
                    <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                      <div>
                        <p
                          className="text-sm text-foreground mb-0.5"
                          style={{ fontFamily: '"Jost", sans-serif' }}
                        >
                          #{order.id}
                        </p>
                        <p
                          className="text-[9px] text-foreground/40"
                          style={{ fontFamily: '"Jost", sans-serif' }}
                        >
                          {new Date(order.date).toLocaleDateString(
                            lang === "ru" ? "ru-RU" : "en-GB",
                            { year: "numeric", month: "long", day: "numeric" }
                          )}
                        </p>
                      </div>
                      <span
                        className={statusClass}
                        style={{ fontFamily: '"Jost", sans-serif' }}
                      >
                        {T.account.status[order.status]}
                      </span>
                    </div>
                    <div className="space-y-2 mb-4">
                      {order.items.map((item) => {
                        const p = products.find((x) => x.id === item.productId);
                        if (!p) return null;
                        return (
                          <div key={`${item.productId}-${item.size}`} className="flex justify-between">
                            <span
                              className="text-sm italic text-foreground/65"
                              style={{ fontFamily: '"Bodoni Moda", Georgia, serif' }}
                            >
                              {lang === "en" ? p.name : p.nameRu}{" "}
                              <span className="not-italic text-xs text-foreground/35">
                                ×{item.quantity} / {item.size}
                              </span>
                            </span>
                            <span
                              className="text-sm text-foreground/55"
                              style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
                            >
                              {(p.price * item.quantity).toLocaleString("ru-RU")} ₽
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between pt-3 border-t border-border flex-wrap gap-2">
                      <span
                        className="text-[9px] tracking-[0.12em] text-foreground/35"
                        style={{ fontFamily: '"Jost", sans-serif' }}
                      >
                        {order.paymentMethod}
                      </span>
                      <span
                        className="text-sm text-foreground"
                        style={{ fontFamily: '"Jost", sans-serif' }}
                      >
                        {order.total.toLocaleString("ru-RU")} ₽
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════
// ADMIN PAGE
// ═══════════════════════════════════════════════════════════════

type AdminTab = "products" | "add" | "activity";

const emptyProductForm = (): Omit<Product, "id"> => ({
  slug: "",
  name: "",
  nameRu: "",
  price: 0,
  description: "",
  descriptionRu: "",
  images: [],
  category: "tops",
  sizes: ["XS", "S", "M", "L", "XL"],
  inStock: true,
  featured: false,
});

function AdminPage() {
  const {
    T,
    lang,
    isAdminAuthenticated,
    logout,
    navigate,
    products,
    activity,
    logActivity,
    saveAdminProduct,
    deleteAdminProduct,
    setAdminProductStock,
  } = useApp();

  const [tab, setTab] = useState<AdminTab>("products");
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Omit<Product, "id">>(emptyProductForm());
  const [sizesStr, setSizesStr] = useState("XS,S,M,L,XL");
  const [imagesStr, setImagesStr] = useState("");
  const [adminError, setAdminError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated) navigate("auth");
  }, [isAdminAuthenticated]);

  if (!isAdminAuthenticated) return null;

  const startEdit = (p: Product) => {
    setAdminError("");
    setEditing(p);
    setForm({
      slug: p.slug,
      name: p.name,
      nameRu: p.nameRu,
      price: p.price,
      description: p.description,
      descriptionRu: p.descriptionRu,
      images: p.images,
      category: p.category,
      sizes: p.sizes,
      inStock: p.inStock,
      featured: p.featured,
    });
    setSizesStr(p.sizes.join(", "));
    setImagesStr(p.images.join(", "));
    setTab("add");
  };

  const handleDelete = async (id: string) => {
    const target = products.find((p) => p.id === id);
    setAdminError("");
    setBusy(true);
    try {
      await deleteAdminProduct(id);
      logActivity(
        `Product deleted: "${target?.name}"`,
        `Товар удалён: "${target?.nameRu || target?.name}"`
      );
    } catch {
      setAdminError(lang === "ru" ? "Не удалось удалить товар." : "Could not delete product.");
    } finally {
      setBusy(false);
    }
  };

  const toggleSoldOut = async (id: string) => {
    const target = products.find((p) => p.id === id);
    if (!target) return;

    setAdminError("");
    setBusy(true);
    try {
      await setAdminProductStock(id, !target.inStock);
      if (target.inStock) {
        logActivity(
          `Product marked sold out: "${target.name}"`,
          `Товар отмечен как распроданный: "${target.nameRu || target.name}"`
        );
      } else {
        logActivity(
          `Product returned to collection: "${target.name}"`,
          `Товар возвращён в коллекцию: "${target.nameRu || target.name}"`
        );
      }
    } catch {
      setAdminError(lang === "ru" ? "Не удалось изменить статус товара." : "Could not update product status.");
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    const images = imagesStr.split(",").map((s) => s.trim()).filter(Boolean);
    const sizes = sizesStr.split(",").map((s) => s.trim()).filter(Boolean);
    const slug = form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const final = { ...form, images, sizes, slug };

    setAdminError("");
    setBusy(true);
    try {
      const saved = await saveAdminProduct(final, editing?.id);
      if (editing) {
        logActivity(`Product updated: "${saved.name}"`, `Товар обновлён: "${saved.nameRu || saved.name}"`);
      } else {
        logActivity(`Product added: "${saved.name}"`, `Товар добавлен: "${saved.nameRu || saved.name}"`);
      }

      setEditing(null);
      setForm(emptyProductForm());
      setImagesStr("");
      setSizesStr("XS,S,M,L,XL");
      setTab("products");
    } catch {
      setAdminError(lang === "ru" ? "Не удалось сохранить товар. Проверьте поля и URL картинок." : "Could not save product. Check fields and image URLs.");
    } finally {
      setBusy(false);
    }
  };

  const cancelEdit = () => {
    setAdminError("");
    setEditing(null);
    setForm(emptyProductForm());
    setImagesStr("");
    setSizesStr("XS,S,M,L,XL");
    setTab("products");
  };

  const fieldClass =
    "w-full bg-secondary border border-border px-4 py-3 text-[13px] text-foreground focus:border-foreground/60 outline-none transition-colors";
  const fieldStyle = { fontFamily: '"Jost", sans-serif', fontWeight: 300 };

  const tabLabel = (t: AdminTab) => {
    if (t === "products") return T.admin.tabs.products;
    if (t === "add") return editing ? T.admin.tabs.edit : T.admin.tabs.add;
    return T.admin.tabs.activity;
  };

  return (
    <main className="pt-16 min-h-screen">
      {/* Admin sub-header */}
      <div className="border-b border-border bg-background">
        <div className="max-w-screen-xl mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-0">
            <span
              className="text-[9px] tracking-[0.22em] text-foreground/35 mr-6"
              style={{ fontFamily: '"Jost", sans-serif' }}
            >
              {T.admin.title}
            </span>
            {(["products", "add", "activity"] as AdminTab[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  if (t !== "add") { setEditing(null); }
                  setTab(t);
                }}
                className={`text-[9px] tracking-[0.18em] px-4 h-12 border-b-[1.5px] transition-all ${
                  tab === t
                    ? "border-foreground text-foreground"
                    : "border-transparent text-foreground/38 hover:text-foreground/65"
                }`}
                style={{ fontFamily: '"Jost", sans-serif' }}
              >
                {tabLabel(t)}
              </button>
            ))}
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-[9px] tracking-[0.18em] text-foreground/35 hover:text-foreground transition-colors"
            style={{ fontFamily: '"Jost", sans-serif' }}
          >
            <LogOut size={12} strokeWidth={1.5} />
            {T.account.signOut}
          </button>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-10">
        {adminError && (
          <div
            className="mb-6 border border-destructive/25 bg-destructive/5 px-4 py-3 text-[12px] text-destructive/80"
            style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
          >
            {adminError}
          </div>
        )}

        {/* ── Products list ── */}
        {tab === "products" && (
          <div>
            <div className="flex items-center justify-between mb-8">
              <h2
                className="text-3xl italic"
                style={{ fontFamily: '"Bodoni Moda", Georgia, serif', fontWeight: 400 }}
              >
                {T.admin.tabs.products}
              </h2>
                <button
                onClick={() => { setAdminError(""); setEditing(null); setForm(emptyProductForm()); setImagesStr(""); setTab("add"); }}
                disabled={busy}
                className="flex items-center gap-2 text-[9px] tracking-[0.18em] bg-foreground text-background px-5 py-3 hover:bg-foreground/80 transition-colors"
                style={{ fontFamily: '"Jost", sans-serif' }}
              >
                <Plus size={13} strokeWidth={2} />
                {T.admin.tabs.add}
              </button>
            </div>

            <div className="space-y-px">
              {products.map((p) => (
                <div key={p.id} className="bg-secondary flex items-center gap-5 p-4">
                  <div className="w-14 h-[72px] bg-muted overflow-hidden shrink-0">
                    {p.images[0] && (
                      <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span
                        className="text-sm italic text-foreground"
                        style={{ fontFamily: '"Bodoni Moda", Georgia, serif' }}
                      >
                        {p.name}
                      </span>
                      {p.featured && (
                        <span
                          className="text-[7.5px] tracking-[0.15em] bg-foreground/8 text-foreground/45 px-2 py-0.5 border border-foreground/10"
                          style={{ fontFamily: '"Jost", sans-serif' }}
                        >
                          FEATURED
                        </span>
                      )}
                      {!p.inStock && (
                        <span
                          className="text-[7.5px] tracking-[0.15em] text-destructive/70 px-2 py-0.5 border border-destructive/20"
                          style={{ fontFamily: '"Jost", sans-serif' }}
                        >
                          SOLD OUT
                        </span>
                      )}
                    </div>
                    <p
                      className="text-[9.5px] text-foreground/40 truncate"
                      style={{ fontFamily: '"Jost", sans-serif' }}
                    >
                      {p.nameRu} · {p.price.toLocaleString("ru-RU")} ₽ · {p.category}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => toggleSoldOut(p.id)}
                      disabled={busy}
                      className={`text-[8.5px] tracking-[0.12em] px-3 py-2 border transition-colors ${
                        p.inStock
                          ? "border-border text-foreground/55 hover:border-foreground/50 hover:text-foreground"
                          : "border-foreground/25 bg-background text-foreground/70 hover:border-foreground/55"
                      }`}
                      style={{ fontFamily: '"Jost", sans-serif' }}
                    >
                      {(p.inStock ? T.admin.markSoldOut : T.admin.restoreStock).toUpperCase()}
                    </button>
                    <button
                      onClick={() => startEdit(p)}
                      disabled={busy}
                      className="text-[8.5px] tracking-[0.12em] px-3 py-2 border border-border hover:border-foreground/50 transition-colors text-foreground/55 hover:text-foreground"
                      style={{ fontFamily: '"Jost", sans-serif' }}
                    >
                      {T.admin.edit.toUpperCase()}
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={busy}
                      className="text-[8.5px] tracking-[0.12em] px-3 py-2 border border-border hover:border-destructive/50 transition-colors text-foreground/55 hover:text-destructive"
                      style={{ fontFamily: '"Jost", sans-serif' }}
                    >
                      {T.admin.delete.toUpperCase()}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Add / Edit product ── */}
        {tab === "add" && (
          <div className="max-w-2xl">
            <h2
              className="text-3xl italic mb-10"
              style={{ fontFamily: '"Bodoni Moda", Georgia, serif', fontWeight: 400 }}
            >
              {editing ? T.admin.tabs.edit : T.admin.tabs.add}
            </h2>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[8.5px] tracking-[0.18em] text-foreground/45 mb-1.5" style={{ fontFamily: '"Jost", sans-serif' }}>{T.admin.nameEn}</label>
                  <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={fieldClass} style={fieldStyle} />
                </div>
                <div>
                  <label className="block text-[8.5px] tracking-[0.18em] text-foreground/45 mb-1.5" style={{ fontFamily: '"Jost", sans-serif' }}>{T.admin.nameRu}</label>
                  <input value={form.nameRu} onChange={(e) => setForm((f) => ({ ...f, nameRu: e.target.value }))} className={fieldClass} style={fieldStyle} />
                </div>
              </div>

              <div>
                <label className="block text-[8.5px] tracking-[0.18em] text-foreground/45 mb-1.5" style={{ fontFamily: '"Jost", sans-serif' }}>{T.admin.price}</label>
                <input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))} className={fieldClass} style={fieldStyle} />
              </div>

              <div>
                <label className="block text-[8.5px] tracking-[0.18em] text-foreground/45 mb-1.5" style={{ fontFamily: '"Jost", sans-serif' }}>{T.admin.descEn}</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className={`${fieldClass} resize-none`} style={fieldStyle} />
              </div>

              <div>
                <label className="block text-[8.5px] tracking-[0.18em] text-foreground/45 mb-1.5" style={{ fontFamily: '"Jost", sans-serif' }}>{T.admin.descRu}</label>
                <textarea value={form.descriptionRu} onChange={(e) => setForm((f) => ({ ...f, descriptionRu: e.target.value }))} rows={3} className={`${fieldClass} resize-none`} style={fieldStyle} />
              </div>

              <div>
                <label className="block text-[8.5px] tracking-[0.18em] text-foreground/45 mb-1.5" style={{ fontFamily: '"Jost", sans-serif' }}>{T.admin.imageUrls}</label>
                <input value={imagesStr} onChange={(e) => setImagesStr(e.target.value)} placeholder="https://..." className={fieldClass} style={fieldStyle} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[8.5px] tracking-[0.18em] text-foreground/45 mb-1.5" style={{ fontFamily: '"Jost", sans-serif' }}>{T.admin.sizes}</label>
                  <input value={sizesStr} onChange={(e) => setSizesStr(e.target.value)} className={fieldClass} style={fieldStyle} />
                </div>
                <div>
                  <label className="block text-[8.5px] tracking-[0.18em] text-foreground/45 mb-1.5" style={{ fontFamily: '"Jost", sans-serif' }}>{T.admin.category}</label>
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={`${fieldClass} cursor-pointer`} style={{ ...fieldStyle, appearance: "none" } as React.CSSProperties}>
                    <option value="tops">Tops</option>
                    <option value="outerwear">Outerwear</option>
                    <option value="dresses">Dresses</option>
                    <option value="accessories">Accessories</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-8 pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={form.inStock} onChange={(e) => setForm((f) => ({ ...f, inStock: e.target.checked }))} className="w-4 h-4 accent-foreground" />
                  <span className="text-[9px] tracking-[0.15em] text-foreground/60" style={{ fontFamily: '"Jost", sans-serif' }}>{T.admin.inStock}</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} className="w-4 h-4 accent-foreground" />
                  <span className="text-[9px] tracking-[0.15em] text-foreground/60" style={{ fontFamily: '"Jost", sans-serif' }}>{T.admin.featured}</span>
                </label>
              </div>

              <div className="flex gap-4 pt-3">
                <button
                  onClick={handleSave}
                  disabled={busy}
                  className={`flex-1 py-4 text-background text-[10px] tracking-[0.22em] transition-colors ${
                    busy ? "bg-foreground/55 cursor-wait" : "bg-foreground hover:bg-foreground/80"
                  }`}
                  style={{ fontFamily: '"Jost", sans-serif' }}
                >
                  {T.admin.save.toUpperCase()}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={busy}
                  className="px-8 py-4 border border-border text-[10px] tracking-[0.18em] hover:border-foreground/50 transition-colors text-foreground/60"
                  style={{ fontFamily: '"Jost", sans-serif' }}
                >
                  {T.admin.cancel.toUpperCase()}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Activity log ── */}
        {tab === "activity" && (
          <div>
            <h2
              className="text-3xl italic mb-8"
              style={{ fontFamily: '"Bodoni Moda", Georgia, serif', fontWeight: 400 }}
            >
              {T.admin.tabs.activity}
            </h2>
            {activity.length === 0 ? (
              <p className="text-sm text-foreground/30" style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}>
                {T.admin.noActivity}
              </p>
            ) : (
              <div className="space-y-px">
                {activity.map((entry) => (
                  <div key={entry.id} className="bg-secondary flex items-center gap-4 px-5 py-4">
                    <Clock size={13} className="text-foreground/28 shrink-0" strokeWidth={1.5} />
                    <p
                      className="flex-1 text-sm text-foreground/70"
                      style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300 }}
                    >
                      {lang === "en" ? entry.action : entry.actionRu}
                    </p>
                    <p
                      className="text-[9px] text-foreground/35 shrink-0"
                      style={{ fontFamily: '"Jost", sans-serif' }}
                    >
                      {new Date(entry.timestamp).toLocaleString(
                        lang === "ru" ? "ru-RU" : "en-GB",
                        { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════

function PageRouter() {
  const { page } = useApp();
  switch (page) {
    case "home":     return <HomePage />;
    case "shop":     return <ShopPage />;
    case "product":  return <ProductPage />;
    case "archive":  return <ArchivePage />;
    case "soldOut":  return <SoldOutPage />;
    case "cart":     return <CartPage />;
    case "checkout": return <CheckoutPage />;
    case "auth":     return <AuthPage />;
    case "account":  return <AccountPage />;
    case "admin":    return <AdminPage />;
    default:         return <HomePage />;
  }
}

// ═══════════════════════════════════════════════════════════════
// ROOT EXPORT
// ═══════════════════════════════════════════════════════════════

export default function App() {
  // SEO: set initial document meta
  useEffect(() => {
    document.title = "FRONTE PARTE — Bespoke Knitwear";

    const setMeta = (name: string, content: string, prop = false) => {
      const sel = prop ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let el = document.querySelector(sel) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        if (prop) el.setAttribute("property", name);
        else el.setAttribute("name", name);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    setMeta("description", "FRONTE PARTE — handmade bespoke knitwear from Russia. Merino, cashmere, alpaca. Every piece made to order.");
    setMeta("keywords", "bespoke knitwear, handmade sweaters, merino, cashmere, alpaca, Russian fashion, luxury knitwear, FRONTE PARTE");
    setMeta("og:title", "FRONTE PARTE — Bespoke Knitwear", true);
    setMeta("og:description", "Handmade luxury knitwear. Made to order.", true);
    setMeta("og:type", "website", true);
    setMeta("twitter:card", "summary_large_image");
  }, []);

  return (
    <AppProvider>
      <div className="min-h-screen bg-background">
        <Nav />
        <PageRouter />
      </div>
    </AppProvider>
  );
}
