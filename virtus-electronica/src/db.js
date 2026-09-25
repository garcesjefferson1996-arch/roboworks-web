import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const id = () => randomUUID();
export function openDb(
  path = process.env.DB_PATH || resolve(root, "data/store.sqlite"),
) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(readFileSync(resolve(root, "src/schema.sql"), "utf8"));
  db.exec(readFileSync(resolve(root, "src/management.sql"), "utf8"));
  const roles = {
    customer: ["account"],
    super_admin: ["*"],
    admin: [
      "products",
      "inventory",
      "orders",
      "customers",
      "content",
      "settings",
      "promotions",
      "inquiries",
    ],
    sales: ["orders", "customers", "promotions"],
    inventory: ["products", "inventory"],
    editor: ["content"],
    support: ["orders:read", "customers", "inquiries"],
  };
  for (const [key, permissions] of Object.entries(roles))
    db.prepare("INSERT OR IGNORE INTO roles VALUES(?,?,?)").run(
      key,
      {
        customer: "Cliente",
        super_admin: "Super Admin",
        admin: "Administrador",
        sales: "Ventas",
        inventory: "Inventario",
        editor: "Editor",
        support: "Soporte",
      }[key],
      JSON.stringify(permissions),
    );
  const defaults = {
    demo: false,
    heroTitle: "Tus ideas.\nSin límites.",
    heroSubtitle:
      "Electrónica, robótica y herramientas para aprender, crear y construir lo que viene.",
    heroImage: "/assets/hero.webp",
    announcement: "Electrónica para aprender. Tecnología para crear.",
    shipping: 500,
    freeShipping: 7500,
    pickupEnabled: true,
    shippingEnabled: true,
    transferEnabled: false,
    bankInstructions: "",
    whatsapp: "",
    email: "",
    address: "",
    businessName: "VIRTUS Electrónica",
    taxId: "",
    institutionalText:
      "Del primer circuito al próximo gran proyecto. Equipamos espacios donde las ideas se convierten en aprendizaje.",
    faq: [
      {
        q: "¿Puedo comprar para mi institución?",
        a: "Solicita una cotización personalizada desde nuestra sección de instituciones.",
      },
      {
        q: "¿Dónde encuentro la documentación?",
        a: "Cada ficha de producto reúne los recursos técnicos publicados para ese componente.",
      },
    ],
    legal: "",
    privacy: "",
    homeSections: ["categories", "featured", "kits", "institutions", "lab"],
  };
  for (const [key, value] of Object.entries(defaults))
    db.prepare("INSERT OR IGNORE INTO settings VALUES(?,?)").run(
      key,
      JSON.stringify(value),
    );
  const editorial = {
    categoryTitle: "¿Qué vas a crear hoy?",
    featuredTitle: "Pequeños grandes protagonistas.",
    kitTitle: "Abre una caja.\nDescubre un mundo.",
    kitText:
      "Kits que transforman la curiosidad en proyectos. Todo empieza con ese primer «¿y si…?».",
    kitImage: "/assets/kit.webp",
    institutionTitle: "El futuro también se aprende.",
    labTitle: "La curiosidad no se detiene.",
  };
  for (const [key, value] of Object.entries(editorial))
    db.prepare("INSERT OR IGNORE INTO settings VALUES(?,?)").run(
      key,
      JSON.stringify(value),
    );
  return db;
}
export function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export const all = (db, sql, ...args) => db.prepare(sql).all(...args);
export const one = (db, sql, ...args) => db.prepare(sql).get(...args);
export function settings(db) {
  return Object.fromEntries(
    all(db, "SELECT * FROM settings").map((r) => [r.key, JSON.parse(r.value)]),
  );
}
export function product(db, p) {
  if (!p) return null;
  return {
    ...p,
    details: JSON.parse(p.details),
    images: all(
      db,
      "SELECT * FROM media WHERE product_id=? ORDER BY position",
      p.id,
    ),
    resources: all(db, "SELECT * FROM resources WHERE product_id=?", p.id),
    variants: all(db, "SELECT * FROM variants WHERE product_id=?", p.id),
    relations: all(
      db,
      "SELECT related_id,kind FROM product_relations WHERE product_id=?",
      p.id,
    ),
  };
}
export const productQuery =
  "SELECT p.*, c.name AS category, c.slug AS category_slug, b.name AS brand FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id";
