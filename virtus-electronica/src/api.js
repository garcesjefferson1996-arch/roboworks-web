import {
  id,
  one,
  all,
  settings,
  product,
  productQuery,
  transaction,
} from "./db.js";
import {
  fail,
  str,
  integer,
  email,
  password,
  passwordHash,
  passwordMatches,
  hash,
  token,
  authorized,
  safeUrl,
} from "./security.js";
import { quote, createOrder, orderDetails, updateOrder } from "./commerce.js";
import { saveProduct, saveCategory } from "./catalog.js";
import { upload } from "./uploads.js";
import { management } from "./management.js";
import { ownerSetupState, createOwner } from './owner.js';

export async function api(db, req, res, url, b, context = {}) {
  const path = url.pathname,
    method = req.method;
  if (path === '/api/auth/owner-setup' && method === 'GET') return ownerSetupState(db, context.setupKey);
  if (path === '/api/auth/owner-setup' && method === 'POST') return createOwner(db, b, context.setupKey);
  const sessionToken = (req.headers.cookie || "")
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("virtus_session="))
    ?.slice(15);
  const session = sessionToken
    ? one(
        db,
        "SELECT u.*,r.permissions FROM sessions s JOIN users u ON u.id=s.user_id JOIN roles r ON r.id=u.role WHERE s.token=? AND s.expires>? AND u.active=1",
        hash(sessionToken),
        Date.now(),
      )
    : null;
  const user = session
    ? {
        id: session.id,
        name: session.name,
        email: session.email,
        phone: session.phone,
        role: session.role,
        permissions: JSON.parse(session.permissions),
      }
    : null;
  const auth = () => {
    if (!user) fail(401, "Inicia sesión para continuar.");
    return user;
  };
  if (path.startsWith("/api/management")) {
    auth();
    if (user.role !== "super_admin") fail(403, "Solo el propietario puede acceder a la gestión financiera y personal.");
    return management(db, req, url, b, user);
  }
  const permit = (p) => {
    auth();
    if (!authorized(user, p)) fail(403, "Tu rol no permite esta acción.");
  };
  const audit = (action, target) =>
    db
      .prepare("INSERT INTO audit(id,actor_id,action,target) VALUES(?,?,?,?)")
      .run(id(), user.id, action, target);
  const login = (uid) => {
    const raw = token();
    db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      hash(raw),
      uid,
      Date.now() + 7 * 86400000,
    );
    res.setHeader(
      "Set-Cookie",
      `virtus_session=${raw}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
  };
  if (path === "/api/bootstrap" && method === "GET")
    return {
      preview: context.preview === true,
      settings: settings(db),
      categories: all(
        db,
        "SELECT * FROM categories WHERE active=1 ORDER BY position,name",
      ),
      brands: all(db, "SELECT * FROM brands ORDER BY name"),
      user,
    };
  if (path === "/api/auth/register" && method === "POST") {
    const address = email(b.email),
      name = str(b.name, "Nombre", 150),
      secret = await passwordHash(password(b.password));
    if (one(db, "SELECT id FROM users WHERE email=?", address))
      fail(409, "No se pudo crear la cuenta con ese correo.");
    const uid = id();
    db.prepare("INSERT INTO users(id,name,email,password) VALUES(?,?,?,?)").run(
      uid,
      name,
      address,
      secret,
    );
    login(uid);
    return {
      id: uid,
      name,
      email: address,
      role: "customer",
      permissions: ["account"],
    };
  }
  if (path === "/api/auth/login" && method === "POST") {
    const address = email(b.email);
    str(b.password, "Contraseña", 128);
    const u = one(
      db,
      "SELECT * FROM users WHERE email=? AND active=1",
      address,
    );
    const dummy = "00000000000000000000000000000000:" + "00".repeat(64);
    const valid = await passwordMatches(b.password, u?.password || dummy);
    if (!u || !valid) fail(401, "Correo o contraseña incorrectos.");
    login(u.id);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      permissions: JSON.parse(
        one(db, "SELECT permissions FROM roles WHERE id=?", u.role).permissions,
      ),
    };
  }
  if (path === "/api/auth/logout" && method === "POST") {
    if (sessionToken)
      db.prepare("DELETE FROM sessions WHERE token=?").run(hash(sessionToken));
    res.setHeader(
      "Set-Cookie",
      "virtus_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
    );
    return { ok: true };
  }
  if (path === "/api/auth/password" && method === "POST") {
    auth();
    if (
      !(await passwordMatches(
        str(b.current, "Contraseña actual", 128),
        session.password,
      ))
    )
      fail(400, "La contraseña actual es incorrecta.");
    const next = await passwordHash(password(b.password));
    transaction(db, () => {
      db.prepare("UPDATE users SET password=? WHERE id=?").run(next, user.id);
      db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
    });
    login(user.id);
    return { ok: true };
  }
  if (path === "/api/me" && method === "PATCH") {
    auth();
    db.prepare("UPDATE users SET name=?,phone=? WHERE id=?").run(
      str(b.name, "Nombre", 150),
      str(b.phone || "", "Teléfono", 30, false),
      user.id,
    );
    return { ok: true };
  }
  if (path === "/api/me" && method === "GET") {
    auth();
    return {
      user,
      addresses: all(
        db,
        "SELECT * FROM addresses WHERE user_id=?",
        user.id,
      ).map((a) => ({ ...a, data: JSON.parse(a.data) })),
      orders: all(
        db,
        "SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC",
        user.id,
      ).map((o) => orderDetails(db, o)),
      favorites: all(
        db,
        "SELECT product_id FROM favorites WHERE user_id=?",
        user.id,
      ).map((f) => f.product_id),
    };
  }
  if (path === "/api/addresses" && method === "POST") {
    auth();
    const data = {
      address: str(b.address, "Dirección", 500),
      city: str(b.city, "Ciudad", 100),
      province: str(b.province, "Provincia", 100),
    };
    const aid = id();
    db.prepare("INSERT INTO addresses VALUES(?,?,?,?)").run(
      aid,
      user.id,
      str(b.label, "Etiqueta", 100),
      JSON.stringify(data),
    );
    return { id: aid };
  }
  if (path.startsWith("/api/addresses/") && method === "DELETE") {
    auth();
    db.prepare("DELETE FROM addresses WHERE id=? AND user_id=?").run(
      path.split("/").pop(),
      user.id,
    );
    return { ok: true };
  }
  if (
    path.startsWith("/api/favorites/") &&
    ["PUT", "DELETE"].includes(method)
  ) {
    auth();
    const pid = path.split("/").pop();
    if (!one(db, "SELECT id FROM products WHERE id=? AND active=1", pid))
      fail(404, "Producto no encontrado.");
    if (method === "PUT")
      db.prepare("INSERT OR IGNORE INTO favorites VALUES(?,?)").run(
        user.id,
        pid,
      );
    else
      db.prepare("DELETE FROM favorites WHERE user_id=? AND product_id=?").run(
        user.id,
        pid,
      );
    return { ok: true };
  }
  if (path === "/api/products" && method === "GET") {
    let where = ["p.active=1", "(c.active=1 OR p.category_id IS NULL)"],
      args = [];
    const q = (url.searchParams.get("q") || "").slice(0, 120);
    if (q) {
      where.push(
        "(p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ? OR p.details LIKE ?)",
      );
      args.push(...Array(4).fill("%" + q + "%"));
    }
    for (const [param, col] of [
      ["category", "c.slug"],
      ["brand", "b.name"],
    ])
      if (url.searchParams.get(param)) {
        where.push(`${col}=?`);
        args.push(url.searchParams.get(param));
      }
    for (const [param, op] of [
      ["min", ">="],
      ["max", "<="],
    ])
      if (url.searchParams.has(param)) {
        where.push(`p.price${op}?`);
        args.push(integer(Number(url.searchParams.get(param)), param));
      }
    for (const key of [
      "voltage",
      "compatibility",
      "level",
      "age",
      "use",
      "technology",
      "type",
    ])
      if (url.searchParams.get(key)) {
        where.push(`json_extract(p.details,'$.${key}') LIKE ?`);
        args.push("%" + url.searchParams.get(key) + "%");
      }
    if (url.searchParams.get("stock") === "1")
      where.push(
        "(p.stock>0 OR EXISTS(SELECT 1 FROM variants v WHERE v.product_id=p.id AND v.stock>0)) AND p.status='available'",
      );
    if (url.searchParams.get("featured") === "1") where.push("p.featured=1");
    if (url.searchParams.get("offers") === "1")
      where.push("p.compare_price>p.price");
    if (url.searchParams.get("kits") === "1")
      where.push("json_extract(p.details,'$.kit')=1");
    const sort =
      {
        price: "p.price ASC",
        expensive: "p.price DESC",
        name: "p.name ASC",
        new: "p.created_at DESC",
        featured: "p.featured DESC,p.name ASC",
      }[url.searchParams.get("sort")] || "p.featured DESC,p.name ASC";
    const limit = Math.min(
        60,
        Math.max(1, Math.floor(Number(url.searchParams.get("limit")) || 24)),
      ),
      page = Math.max(1, Math.floor(Number(url.searchParams.get("page")) || 1));
    const base = productQuery + " WHERE " + where.join(" AND ");
    const total = one(
      db,
      "SELECT COUNT(*) as n FROM (" + base + ")",
      ...args,
    ).n;
    return {
      items: all(
        db,
        base + ` ORDER BY ${sort} LIMIT ? OFFSET ?`,
        ...args,
        limit,
        (page - 1) * limit,
      ).map((p) => product(db, p)),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }
  if (path.startsWith("/api/products/") && method === "GET") {
    const p = product(
      db,
      one(
        db,
        productQuery + " WHERE (p.slug=? OR p.id=?) AND p.active=1",
        path.split("/").pop(),
        path.split("/").pop(),
      ),
    );
    if (!p) fail(404, "Este producto no está disponible.");
    return p;
  }
  if (path === "/api/search" && method === "GET") {
    const q = "%" + (url.searchParams.get("q") || "").slice(0, 120) + "%";
    return {
      products: all(
        db,
        productQuery +
          " WHERE p.active=1 AND (p.name LIKE ? OR p.sku LIKE ? OR p.details LIKE ?) LIMIT 6",
        q,
        q,
        q,
      ).map((p) => product(db, p)),
      categories: all(
        db,
        "SELECT * FROM categories WHERE active=1 AND name LIKE ? LIMIT 4",
        q,
      ),
      articles: all(
        db,
        "SELECT slug,title,tag FROM articles WHERE active=1 AND (title LIKE ? OR body LIKE ?) LIMIT 3",
        q,
        q,
      ),
    };
  }
  if (path === "/api/quote" && method === "POST") {
    const q = quote(db, b);
    return { ...q, coupon: q.coupon?.code || null };
  }
  if (path === "/api/orders" && method === "POST")
    return createOrder(db, b, user);
  if (/^\/api\/orders\/[^/]+\/invoice$/.test(path) && method === "GET") {
    auth();
    const oid = path.split("/")[3],
      o = one(db, "SELECT user_id FROM orders WHERE id=?", oid);
    if (
      !o ||
      (o.user_id !== user.id &&
        !authorized(user, "orders") &&
        !authorized(user, "orders:read"))
    )
      fail(404, "Factura no encontrada.");
    const invoice = one(
      db,
      "SELECT name,data FROM invoices WHERE order_id=?",
      oid,
    );
    if (!invoice) fail(404, "Aún no hay una factura adjunta.");
    return invoice;
  }
  if (path.startsWith("/api/orders/") && method === "GET") {
    const o = one(db, "SELECT * FROM orders WHERE id=?", path.split("/").pop());
    if (
      !o ||
      (!(user && o.user_id === user.id) &&
        url.searchParams.get("token") !== o.access_token)
    )
      fail(404, "Pedido no encontrado.");
    return orderDetails(db, o);
  }
  if (path === "/api/inquiries" && method === "POST") {
    if (b.website) fail(400, "Solicitud inválida.");
    const iid = id();
    db.prepare(
      "INSERT INTO inquiries(id,name,email,phone,organization,kind,message) VALUES(?,?,?,?,?,?,?)",
    ).run(
      iid,
      str(b.name, "Nombre", 150),
      email(b.email),
      str(b.phone || "", "Teléfono", 30, false),
      str(b.organization || "", "Institución", 200, false),
      str(b.kind || "Consulta", "Tipo", 100),
      str(b.message, "Mensaje", 5000),
    );
    return { id: iid };
  }
  if (path === "/api/articles" && method === "GET")
    return all(
      db,
      "SELECT id,slug,title,excerpt,image,tag,created_at FROM articles WHERE active=1 ORDER BY created_at DESC",
    );
  if (path.startsWith("/api/articles/") && method === "GET") {
    const a = one(
      db,
      "SELECT * FROM articles WHERE slug=? AND active=1",
      path.split("/").pop(),
    );
    if (!a) fail(404, "Recurso no encontrado.");
    return {
      ...a,
      products: all(
        db,
        productQuery +
          " JOIN article_products ap ON ap.product_id=p.id WHERE ap.article_id=? AND p.active=1",
        a.id,
      ).map((p) => product(db, p)),
    };
  }
  if (!path.startsWith("/api/admin")) fail(404, "Ruta no encontrada.");
  auth();
  if (path === "/api/admin/uploads" && method === "POST") {
    if (!["products", "content", "settings"].some((p) => authorized(user, p)))
      fail(403, "No tienes permiso para subir archivos.");
    const result = await upload(b);
    audit("upload.create", result.url);
    return result;
  }
  if (
    /^\/api\/admin\/orders\/[^/]+\/invoice$/.test(path) &&
    method === "POST"
  ) {
    permit("orders");
    const oid = path.split("/")[4];
    if (!one(db, "SELECT id FROM orders WHERE id=?", oid))
      fail(404, "Pedido no encontrado.");
    str(b.name, "Nombre", 200);
    str(b.data, "PDF", 14500000);
    const bytes = Buffer.from(b.data, "base64");
    if (
      bytes.length > 10 * 1024 * 1024 ||
      bytes.toString("ascii", 0, 5) !== "%PDF-"
    )
      fail(400, "Adjunta un PDF válido de hasta 10 MB.");
    db.prepare(
      "INSERT INTO invoices(order_id,name,data) VALUES(?,?,?) ON CONFLICT(order_id) DO UPDATE SET name=excluded.name,data=excluded.data,created_at=CURRENT_TIMESTAMP",
    ).run(
      oid,
      b.name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.[^.]+$/, "") + ".pdf",
      b.data,
    );
    audit("invoice.attach", oid);
    return { ok: true };
  }
  if (path === "/api/admin/summary" && method === "GET") {
    if (!user.permissions.some((p) => p !== "account"))
      fail(403, "Acceso restringido.");
    const canSales =
      authorized(user, "orders") || authorized(user, "orders:read");
    const metrics = canSales
      ? one(
          db,
          "SELECT COUNT(*) as orders,COALESCE(SUM(CASE WHEN status IN ('Pago confirmado','Preparando pedido','Enviado','Entregado') THEN total ELSE 0 END),0) as revenue,COALESCE(AVG(CASE WHEN status IN ('Pago confirmado','Preparando pedido','Enviado','Entregado') THEN total END),0) as average FROM orders WHERE demo=0",
        )
      : { orders: 0, revenue: 0, average: 0 };
    return {
      metrics,
      customers: authorized(user, "customers")
        ? one(db, "SELECT COUNT(*) n FROM users WHERE role='customer'").n
        : 0,
      lowStock: authorized(user, "inventory")
        ? all(
            db,
            "SELECT id,name,sku,stock,min_stock FROM products WHERE stock<=min_stock AND active=1",
          )
        : [],
      daily: canSales
        ? all(
            db,
            "SELECT date(created_at) day,SUM(total) total FROM orders WHERE demo=0 AND status IN ('Pago confirmado','Preparando pedido','Enviado','Entregado') AND created_at>=datetime('now','-30 days') GROUP BY day",
          )
        : [],
      bestsellers: canSales
        ? all(
            db,
            "SELECT i.name,SUM(i.quantity) quantity FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.demo=0 AND o.status IN ('Pago confirmado','Preparando pedido','Enviado','Entregado') GROUP BY i.product_id ORDER BY quantity DESC LIMIT 5",
          )
        : [],
    };
  }
  if (path === "/api/admin/products" && method === "GET") {
    permit("products");
    return all(db, productQuery + " ORDER BY p.created_at DESC").map((p) =>
      product(db, p),
    );
  }
  if (path === "/api/admin/products" && method === "POST") {
    permit("products");
    const p = saveProduct(db, b, null, user.id);
    audit("product.create", p.id);
    return p;
  }
  const pm = path.match(/^\/api\/admin\/products\/([^/]+)(?:\/(duplicate))?$/);
  if (pm) {
    permit("products");
    const pid = pm[1];
    if (method === "PUT") {
      const p = saveProduct(db, b, pid, user.id);
      audit("product.update", pid);
      return p;
    }
    if (method === "POST" && pm[2]) {
      const p = product(db, one(db, "SELECT * FROM products WHERE id=?", pid));
      if (!p) fail(404, "Producto no encontrado.");
      const suffix = token().slice(0, 6);
      return saveProduct(
        db,
        {
          ...p,
          name: p.name + " (copia)",
          slug: p.slug + "-" + suffix,
          sku: p.sku + "-" + suffix,
          stock: 0,
          active: 0,
          variants: p.variants.map((v) => ({
            ...v,
            id: undefined,
            sku: v.sku + "-" + suffix,
            stock: 0,
          })),
        },
        null,
        user.id,
      );
    }
    if (method === "DELETE") {
      if (one(db, "SELECT id FROM order_items WHERE product_id=?", pid))
        fail(
          409,
          "Este producto tiene pedidos. Desactívalo para conservar el historial.",
        );
      transaction(db, () => {
        db.prepare("DELETE FROM inventory_movements WHERE product_id=?").run(
          pid,
        );
        db.prepare("DELETE FROM article_products WHERE product_id=?").run(pid);
        db.prepare("DELETE FROM reviews WHERE product_id=?").run(pid);
        db.prepare("DELETE FROM products WHERE id=?").run(pid);
      });
      audit("product.delete", pid);
      return { ok: true };
    }
  }
  if (path === "/api/admin/categories" && method === "GET") {
    permit("products");
    return all(db, "SELECT * FROM categories ORDER BY position");
  }
  if (path === "/api/admin/categories" && method === "POST") {
    permit("products");
    return saveCategory(db, b);
  }
  if (path.startsWith("/api/admin/categories/")) {
    permit("products");
    const cid = path.split("/").pop();
    if (method === "PUT") return saveCategory(db, b, cid);
    if (method === "DELETE") {
      if (
        one(db, "SELECT id FROM products WHERE category_id=?", cid) ||
        one(db, "SELECT id FROM categories WHERE parent_id=?", cid)
      )
        fail(409, "La categoría tiene productos o subcategorías.");
      db.prepare("DELETE FROM categories WHERE id=?").run(cid);
      return { ok: true };
    }
  }
  if (path === "/api/admin/brands" && method === "POST") {
    permit("products");
    const bid = id();
    db.prepare("INSERT INTO brands VALUES(?,?)").run(
      bid,
      str(b.name, "Marca", 100),
    );
    return { id: bid };
  }
  if (path === "/api/admin/inventory" && method === "GET") {
    permit("inventory");
    return {
      products: all(
        db,
        "SELECT id,name,sku,stock,min_stock FROM products ORDER BY name",
      ).map((p) => ({
        ...p,
        variants: all(db, "SELECT * FROM variants WHERE product_id=?", p.id),
      })),
      movements: all(
        db,
        "SELECT m.*,p.name FROM inventory_movements m JOIN products p ON p.id=m.product_id ORDER BY m.created_at DESC LIMIT 200",
      ),
    };
  }
  if (path === "/api/admin/inventory" && method === "POST") {
    permit("inventory");
    const quantity = integer(b.quantity, "Cantidad", -100000, 100000),
      reason = str(b.reason, "Motivo", 500),
      pid = str(b.product_id, "Producto"),
      vid = b.variant_id || null;
    if (!quantity) fail(400, "La cantidad debe ser distinta de cero.");
    return transaction(db, () => {
      const table = vid ? "variants" : "products",
        key = vid || pid;
      if (
        vid &&
        !one(
          db,
          "SELECT id FROM variants WHERE id=? AND product_id=?",
          vid,
          pid,
        )
      )
        fail(400, "Variante inválida.");
      const r = db
        .prepare(`UPDATE ${table} SET stock=stock+? WHERE id=? AND stock+?>=0`)
        .run(quantity, key, quantity);
      if (!r.changes) fail(409, "Producto inválido o stock insuficiente.");
      db.prepare(
        "INSERT INTO inventory_movements(id,product_id,variant_id,quantity,reason,actor_id) VALUES(?,?,?,?,?,?)",
      ).run(id(), pid, vid, quantity, reason, user.id);
      audit("inventory.adjust", pid);
      return { ok: true };
    });
  }
  if (path === "/api/admin/orders" && method === "GET") {
    if (!authorized(user, "orders") && !authorized(user, "orders:read"))
      fail(403, "Acceso restringido.");
    return all(
      db,
      "SELECT * FROM orders ORDER BY created_at DESC LIMIT 500",
    ).map((o) => orderDetails(db, o));
  }
  if (path.startsWith("/api/admin/orders/") && method === "PATCH") {
    permit("orders");
    const o = updateOrder(db, path.split("/").pop(), b.status, user);
    audit("order.status", o.id);
    return o;
  }
  if (path === "/api/admin/customers" && method === "GET") {
    permit("customers");
    return all(
      db,
      "SELECT u.id,u.name,u.email,u.phone,u.role,u.active,u.created_at,(SELECT COUNT(*) FROM orders o WHERE o.user_id=u.id) orders,(SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.user_id=u.id AND o.status IN ('Pago confirmado','Preparando pedido','Enviado','Entregado')) spent FROM users u ORDER BY u.created_at DESC",
    ).map((u) => ({
      ...u,
      addresses: all(
        db,
        "SELECT label,data FROM addresses WHERE user_id=?",
        u.id,
      ).map((a) => ({ ...a, data: JSON.parse(a.data) })),
    }));
  }
  if (path === "/api/admin/roles" && method === "GET") {
    permit("*");
    return all(db, "SELECT * FROM roles").map((r) => ({
      ...r,
      permissions: JSON.parse(r.permissions),
    }));
  }
  if (path.startsWith("/api/admin/roles/") && method === "PUT") {
    permit("*");
    const rid = path.split("/").pop();
    if (["super_admin", "customer"].includes(rid))
      fail(400, "Este rol está protegido.");
    const allowed = [
      "products",
      "inventory",
      "orders",
      "orders:read",
      "customers",
      "content",
      "settings",
      "promotions",
      "inquiries",
    ];
    if (
      !Array.isArray(b.permissions) ||
      b.permissions.some((p) => !allowed.includes(p))
    )
      fail(400, "Permisos inválidos.");
    db.prepare("UPDATE roles SET permissions=? WHERE id=?").run(
      JSON.stringify(b.permissions),
      rid,
    );
    audit("role.update", rid);
    return { ok: true };
  }
  if (path.startsWith("/api/admin/users/") && method === "PATCH") {
    permit("*");
    const uid = path.split("/").pop();
    if (uid === user.id) fail(400, "No puedes cambiar tu propio acceso.");
    if (!one(db, "SELECT id FROM roles WHERE id=?", b.role))
      fail(400, "Rol inválido.");
    if (b.role === 'super_admin') fail(403, 'Este sistema es de un solo propietario. No puedes conceder ese acceso a otra cuenta.');
    db.prepare("UPDATE users SET role=?,active=? WHERE id=?").run(
      b.role,
      b.active ? 1 : 0,
      uid,
    );
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(uid);
    audit("user.access", uid);
    return { ok: true };
  }
  if (path === "/api/admin/coupons" && method === "GET") {
    permit("promotions");
    return all(db, "SELECT * FROM coupons");
  }
  if (path === "/api/admin/coupons" && method === "POST") {
    permit("promotions");
    return saveCoupon(db, b);
  }
  if (path.startsWith("/api/admin/coupons/") && method === "PUT") {
    permit("promotions");
    return saveCoupon(db, b, path.split("/").pop());
  }
  if (path === "/api/admin/articles" && method === "GET") {
    permit("content");
    return all(db, "SELECT * FROM articles").map((a) => ({
      ...a,
      product_ids: all(
        db,
        "SELECT product_id FROM article_products WHERE article_id=?",
        a.id,
      ).map((p) => p.product_id),
    }));
  }
  if (path === "/api/admin/articles" && method === "POST") {
    permit("content");
    return saveArticle(db, b);
  }
  if (path.startsWith("/api/admin/articles/")) {
    permit("content");
    const aid = path.split("/").pop();
    if (method === "PUT") return saveArticle(db, b, aid);
    if (method === "DELETE") {
      db.prepare("DELETE FROM articles WHERE id=?").run(aid);
      return { ok: true };
    }
  }
  if (path === "/api/admin/settings" && method === "GET") {
    permit("settings");
    return settings(db);
  }
  if (path === "/api/admin/settings" && method === "PUT") {
    permit("settings");
    const current = settings(db);
    for (const [key, value] of Object.entries(b)) {
      if (!(key in current)) fail(400, "Configuración desconocida.");
      if (typeof value !== typeof current[key])
        fail(400, `Tipo inválido: ${key}`);
      if (["shipping", "freeShipping"].includes(key)) integer(value, key);
      if (key === "whatsapp" && value && !/^\d{8,15}$/.test(value))
        fail(400, "WhatsApp: usa el número internacional sin +.");
      if (["heroImage", "kitImage"].includes(key)) safeUrl(value);
      if (JSON.stringify(value).length > 30000)
        fail(400, "Contenido demasiado extenso.");
    }
    if (
      b.homeSections &&
      (!Array.isArray(b.homeSections) ||
        b.homeSections.some(
          (s) =>
            !["categories", "featured", "kits", "institutions", "lab"].includes(
              s,
            ),
        ))
    )
      fail(400, "Secciones inválidas.");
    if (b.faq) {
      if (!Array.isArray(b.faq) || b.faq.length > 50)
        fail(400, "Preguntas inválidas.");
      for (const f of b.faq) {
        str(f.q, "Pregunta", 500);
        str(f.a, "Respuesta", 3000);
      }
    }
    if (b.transferEnabled && !(b.bankInstructions || current.bankInstructions))
      fail(
        400,
        "Añade las instrucciones bancarias antes de activar transferencias.",
      );
    if (
      b.demo === false &&
      current.demo &&
      one(db, "SELECT id FROM products WHERE active=1 AND demo=1")
    )
      fail(
        400,
        "Desactiva o convierte los productos demo antes de salir del modo demostración.",
      );
    transaction(db, () => {
      for (const [key, value] of Object.entries(b))
        db.prepare("UPDATE settings SET value=? WHERE key=?").run(
          JSON.stringify(value),
          key,
        );
    });
    audit("settings.update", "store");
    return settings(db);
  }
  if (path === "/api/admin/inquiries" && method === "GET") {
    permit("inquiries");
    return all(db, "SELECT * FROM inquiries ORDER BY created_at DESC");
  }
  if (path.startsWith("/api/admin/inquiries/") && method === "PATCH") {
    permit("inquiries");
    if (!["Nueva", "En revisión", "Respondida", "Cerrada"].includes(b.status))
      fail(400, "Estado inválido.");
    db.prepare("UPDATE inquiries SET status=? WHERE id=?").run(
      b.status,
      path.split("/").pop(),
    );
    return { ok: true };
  }
  fail(404, "Ruta no encontrada.");
}
function saveCoupon(db, b, cid) {
  if (!["percent", "fixed"].includes(b.kind)) fail(400, "Tipo inválido.");
  for (const k of ["starts_at", "ends_at"])
    if (b[k] && !/^\d{4}-\d{2}-\d{2}$/.test(b[k])) fail(400, "Fecha inválida.");
  if (b.starts_at && b.ends_at && b.starts_at > b.ends_at)
    fail(400, "El inicio debe ser anterior al fin.");
  const key = cid || id();
  db.prepare(
    "INSERT INTO coupons(id,code,kind,value,min_total,max_uses,starts_at,ends_at,active) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET code=excluded.code,kind=excluded.kind,value=excluded.value,min_total=excluded.min_total,max_uses=excluded.max_uses,starts_at=excluded.starts_at,ends_at=excluded.ends_at,active=excluded.active",
  ).run(
    key,
    str(b.code, "Código", 40).toUpperCase(),
    b.kind,
    integer(b.value, "Valor", 1, b.kind === "percent" ? 100 : 10000000),
    integer(b.min_total || 0, "Mínimo"),
    integer(b.max_uses || 100, "Usos", 1),
    b.starts_at || "",
    b.ends_at || "",
    b.active ? 1 : 0,
  );
  return one(db, "SELECT * FROM coupons WHERE id=?", key);
}
function saveArticle(db, b, aid) {
  const key = aid || id(),
    slug = str(b.slug, "URL", 150);
  if (!/^[a-z0-9-]+$/.test(slug)) fail(400, "URL inválida.");
  return transaction(db, () => {
    db.prepare(
      "INSERT INTO articles(id,slug,title,excerpt,body,image,tag,active) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,excerpt=excluded.excerpt,body=excluded.body,image=excluded.image,tag=excluded.tag,active=excluded.active",
    ).run(
      key,
      slug,
      str(b.title, "Título", 200),
      str(b.excerpt || "", "Resumen", 500, false),
      str(b.body || "", "Contenido", 50000, false),
      safeUrl(b.image || ""),
      str(b.tag || "Guía", "Etiqueta", 80),
      b.active ? 1 : 0,
    );
    if (
      !Array.isArray(b.product_ids || []) ||
      (b.product_ids || []).length > 100
    )
      fail(400, "Productos inválidos.");
    db.prepare("DELETE FROM article_products WHERE article_id=?").run(key);
    for (const pid of b.product_ids || [])
      db.prepare("INSERT INTO article_products VALUES(?,?)").run(
        key,
        str(pid, "Producto"),
      );
    return { id: key };
  });
}
