import { id, one, all, transaction, product, productQuery } from "./db.js";
import { str, integer, safeUrl, fail } from "./security.js";
const arr = (v, max = 100) => {
  if (!Array.isArray(v) || v.length > max) fail(400, "Lista inválida.");
  return v;
};
export function saveProduct(db, b, pid, actor) {
  const p = {
    id: pid || id(),
    slug: str(b.slug, "URL", 140),
    sku: str(b.sku, "SKU", 80),
    name: str(b.name, "Nombre", 180),
    category_id: b.category_id || null,
    brand_id: b.brand_id || null,
    description: str(b.description || "", "Descripción", 16000, false),
    price: integer(b.price, "Precio"),
    compare_price: integer(b.compare_price || 0, "Precio anterior"),
    min_stock: integer(b.min_stock ?? 5, "Stock mínimo", 0, 100000),
    status: b.status || "available",
    active: b.active ? 1 : 0,
    featured: b.featured ? 1 : 0,
    demo: b.demo ? 1 : 0,
  };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug))
    fail(400, "La URL debe usar letras minúsculas, números y guiones.");
  if (!["available", "coming", "on_order"].includes(p.status))
    fail(400, "Estado de producto inválido.");
  if (
    p.category_id &&
    !one(db, "SELECT id FROM categories WHERE id=?", p.category_id)
  )
    fail(400, "Categoría inválida.");
  if (p.brand_id && !one(db, "SELECT id FROM brands WHERE id=?", p.brand_id))
    fail(400, "Marca inválida.");
  const details = b.details || {};
  if (
    typeof details !== "object" ||
    Array.isArray(details) ||
    JSON.stringify(details).length > 30000
  )
    fail(400, "Detalles inválidos.");
  for (const key of ["features", "includes", "projects", "applications"])
    if (details[key] !== undefined)
      arr(details[key], 100).forEach((v) => str(v, key, 1000));
  if (details.specifications !== undefined) {
    if (
      !details.specifications ||
      typeof details.specifications !== "object" ||
      Array.isArray(details.specifications)
    )
      fail(400, "Especificaciones inválidas.");
    for (const [k, v] of Object.entries(details.specifications)) {
      str(k, "Característica", 100);
      str(v, "Valor", 1000);
    }
  }
  for (const key of [
    "voltage",
    "current",
    "dimensions",
    "weight",
    "material",
    "compatibility",
    "level",
    "age",
    "use",
    "technology",
    "type",
    "tags",
    "students",
    "software",
    "recommendations",
    "note",
    "seoTitle",
    "seoDescription",
  ])
    if (details[key] !== undefined) str(details[key], key, 3000, false);
  for (const tier of arr(details.quantityDiscounts || [])) {
    integer(tier.quantity, "Cantidad mínima", 2, 1000);
    integer(tier.percent, "Descuento", 1, 100);
  }
  const media = arr(b.images || [], 20).map((m) => ({
    url: safeUrl(m.url),
    kind: m.kind === "video" ? "video" : "image",
    alt: str(m.alt || p.name, "Descripción de imagen", 200),
  }));
  const resources = arr(b.resources || [], 50).map((r) => ({
    title: str(r.title, "Título del recurso", 200),
    kind: str(r.kind, "Tipo de recurso", 60),
    url: safeUrl(r.url),
  }));
  const variants = arr(b.variants || [], 100).map((v) => ({
    id: v.id || id(),
    name: str(v.name, "Variante", 100),
    sku: str(v.sku, "SKU de variante", 80),
    price: integer(v.price, "Precio"),
    stock: integer(v.stock || 0, "Stock", 0, 100000),
  }));
  const relations = arr(b.relations || [], 100).map((r) => ({
    related_id: str(r.related_id, "Relacionado"),
    kind: ["related", "compatible", "bundle"].includes(r.kind)
      ? r.kind
      : "related",
  }));
  return transaction(db, () => {
    const old = one(db, "SELECT * FROM products WHERE id=?", p.id);
    if (pid && !old) fail(404, "Producto no encontrado.");
    const stock = old?.stock ?? integer(b.stock || 0, "Stock", 0, 100000);
    db.prepare(
      `INSERT INTO products(id,slug,sku,name,category_id,brand_id,description,price,compare_price,stock,min_stock,status,active,featured,demo,details) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,sku=excluded.sku,name=excluded.name,category_id=excluded.category_id,brand_id=excluded.brand_id,description=excluded.description,price=excluded.price,compare_price=excluded.compare_price,min_stock=excluded.min_stock,status=excluded.status,active=excluded.active,featured=excluded.featured,demo=excluded.demo,details=excluded.details`,
    ).run(
      p.id,
      p.slug,
      p.sku,
      p.name,
      p.category_id,
      p.brand_id,
      p.description,
      p.price,
      p.compare_price,
      stock,
      p.min_stock,
      p.status,
      p.active,
      p.featured,
      p.demo,
      JSON.stringify(details),
    );
    if (!old && stock)
      db.prepare(
        "INSERT INTO inventory_movements(id,product_id,quantity,reason,actor_id) VALUES(?,?,?,?,?)",
      ).run(id(), p.id, stock, "Inventario inicial", actor);
    db.prepare("DELETE FROM media WHERE product_id=?").run(p.id);
    media.forEach((m, i) =>
      db
        .prepare("INSERT INTO media VALUES(?,?,?,?,?,?)")
        .run(id(), p.id, m.url, m.kind, m.alt, i),
    );
    db.prepare("DELETE FROM resources WHERE product_id=?").run(p.id);
    resources.forEach((r) =>
      db
        .prepare("INSERT INTO resources VALUES(?,?,?,?,?)")
        .run(id(), p.id, r.title, r.kind, r.url),
    );
    for (const v of all(db, "SELECT * FROM variants WHERE product_id=?", p.id))
      if (!variants.some((n) => n.id === v.id)) {
        if (one(db, "SELECT id FROM order_items WHERE variant_id=?", v.id))
          fail(409, "Una variante vendida debe conservarse.");
        db.prepare("DELETE FROM inventory_movements WHERE variant_id=?").run(
          v.id,
        );
        db.prepare("DELETE FROM variants WHERE id=?").run(v.id);
      }
    variants.forEach((v) => {
      const oldV = one(db, "SELECT * FROM variants WHERE id=?", v.id);
      if (oldV && oldV.product_id !== p.id)
        fail(400, "Variante ajena al producto.");
      db.prepare(
        "INSERT INTO variants VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,sku=excluded.sku,price=excluded.price",
      ).run(v.id, p.id, v.name, v.sku, v.price, oldV?.stock ?? v.stock);
      if (!oldV && v.stock)
        db.prepare(
          "INSERT INTO inventory_movements(id,product_id,variant_id,quantity,reason,actor_id) VALUES(?,?,?,?,?,?)",
        ).run(
          id(),
          p.id,
          v.id,
          v.stock,
          "Inventario inicial de variante",
          actor,
        );
    });
    db.prepare("DELETE FROM product_relations WHERE product_id=?").run(p.id);
    relations.forEach((r) => {
      if (
        r.related_id === p.id ||
        !one(db, "SELECT id FROM products WHERE id=?", r.related_id)
      )
        fail(400, "Relación inválida.");
      db.prepare("INSERT INTO product_relations VALUES(?,?,?)").run(
        p.id,
        r.related_id,
        r.kind,
      );
    });
    return product(db, one(db, productQuery + " WHERE p.id=?", p.id));
  });
}
export function saveCategory(db, b, cid) {
  const slug = str(b.slug, "URL", 100);
  if (!/^[a-z0-9-]+$/.test(slug)) fail(400, "URL inválida.");
  const key = cid || id(),
    parent = b.parent_id || null;
  if (parent) {
    let current = parent;
    const seen = new Set([key]);
    while (current) {
      if (seen.has(current)) fail(400, "No se permiten categorías circulares.");
      seen.add(current);
      const node = one(
        db,
        "SELECT parent_id FROM categories WHERE id=?",
        current,
      );
      if (!node) fail(400, "Categoría padre inexistente.");
      current = node.parent_id;
    }
  }
  db.prepare(
    "INSERT INTO categories VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,name=excluded.name,description=excluded.description,image=excluded.image,parent_id=excluded.parent_id,position=excluded.position,active=excluded.active",
  ).run(
    key,
    slug,
    str(b.name, "Nombre", 150),
    str(b.description || "", "Descripción", 1000, false),
    safeUrl(b.image || ""),
    parent,
    integer(b.position || 0, "Orden", 0, 10000),
    b.active ? 1 : 0,
  );
  return one(db, "SELECT * FROM categories WHERE id=?", key);
}
