import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { openDb, id, one } from "../src/db.js";
import { seed } from "../src/seed.js";
import { createApp } from "../src/server.js";
import { passwordHash } from "../src/security.js";
const db = openDb(":memory:");
let server, base, adminCookie, customerCookie, customer, product, order;
const origin = "http://localhost:3109";
async function request(
  path,
  { method = "GET", body, cookie, originOverride = origin } = {},
) {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      Origin: originOverride,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    body: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
    headers: r.headers,
  };
}
before(async () => {
  seed(db);
  db.prepare(
    "INSERT INTO users(id,name,email,password,role) VALUES(?,?,?,?,?)",
  ).run(
    id(),
    "Admin QA",
    "admin@example.test",
    await passwordHash("OnlyForTesting-12345"),
    "super_admin",
  );
  server = createApp(db, { origin });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = "http://127.0.0.1:" + server.address().port;
});
after(async () => {
  await new Promise((r) => server.close(r));
  db.close();
});
test("catalog and partial search use database", async () => {
  const r = await request("/products");
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 12);
  product = r.body.items.find((p) => p.slug === "arduino-uno-r3");
  const search = await request("/search?q=servo");
  assert.ok(search.body.products.some((p) => p.slug === "servo-sg90"));
  assert.ok(search.body.products.some((p) => p.slug === "servo-mg996r"));
  const filter = await request("/products?category=esp32&max=1000&stock=1");
  assert.equal(filter.body.items.length, 1);
});
test("register hashes password and sets HttpOnly session", async () => {
  const r = await request("/auth/register", {
    method: "POST",
    body: {
      name: "Cliente QA",
      email: "customer@example.test",
      password: "Client-Testing-12345",
    },
  });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("set-cookie"), /HttpOnly/);
  customer = r.body;
  customerCookie = r.cookie;
  const u = one(db, "SELECT password FROM users WHERE id=?", customer.id);
  assert.notEqual(u.password, "Client-Testing-12345");
  assert.equal(u.password.split(":")[1].length, 128);
});
test("invalid login and unauthorized admin rejected", async () => {
  assert.equal((await request("/admin/products")).status, 401);
  assert.equal(
    (await request("/admin/products", { cookie: customerCookie })).status,
    403,
  );
  assert.equal(
    (
      await request("/auth/login", {
        method: "POST",
        body: { email: "customer@example.test", password: "invalidpassword" },
      })
    ).status,
    401,
  );
  const r = await request("/auth/login", {
    method: "POST",
    body: { email: "admin@example.test", password: "OnlyForTesting-12345" },
  });
  assert.equal(r.status, 200);
  adminCookie = r.cookie;
});
test("cross-origin writes rejected", async () => {
  const r = await request("/me", {
    method: "PATCH",
    cookie: customerCookie,
    originOverride: "https://malicious.example",
    body: { name: "changed", phone: "" },
  });
  assert.equal(r.status, 403);
});
test("favorite and addresses persist, users isolated", async () => {
  assert.equal(
    (
      await request("/favorites/" + product.id, {
        method: "PUT",
        cookie: customerCookie,
        body: {},
      })
    ).status,
    200,
  );
  const a = await request("/addresses", {
    method: "POST",
    cookie: customerCookie,
    body: {
      label: "Casa",
      address: "Dirección de prueba",
      city: "Ambato",
      province: "Tungurahua",
    },
  });
  assert.equal(a.status, 200);
  const me = await request("/me", { cookie: customerCookie });
  assert.equal(me.body.addresses.length, 1);
  assert.deepEqual(me.body.favorites, [product.id]);
  assert.equal(
    (await request("/me", { cookie: adminCookie })).body.addresses.length,
    0,
  );
});
test("quote rejects invalid quantities, duplicate lines and stock overflow", async () => {
  for (const items of [
    [{ product_id: product.id, quantity: -1 }],
    [{ product_id: product.id, quantity: 999 }],
    [
      { product_id: product.id, quantity: 1 },
      { product_id: product.id, quantity: 1 },
    ],
  ]) {
    const r = await request("/quote", { method: "POST", body: { items } });
    assert.ok(r.status >= 400);
  }
});
const checkoutBody = () => ({
  items: [{ product_id: product.id, quantity: 2, price: 1 }],
  customer: {
    name: "Cliente QA",
    email: "customer@example.test",
    phone: "0990000000",
    city: "Ambato",
    province: "Tungurahua",
    address: "Calle de prueba",
  },
  delivery: "pickup",
  payment_method: "pickup",
  accepted: true,
  idempotency: "qa-idempotency-key-12345678",
});
test("checkout server prices, stock reservation and idempotency", async () => {
  const before = one(
    db,
    "SELECT stock FROM products WHERE id=?",
    product.id,
  ).stock;
  const r = await request("/orders", {
    method: "POST",
    cookie: customerCookie,
    body: checkoutBody(),
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  order = r.body;
  assert.equal(order.total, product.price * 2);
  assert.equal(
    one(db, "SELECT stock FROM products WHERE id=?", product.id).stock,
    before - 2,
  );
  assert.equal(order.items.length, 1);
  const retry = await request("/orders", {
    method: "POST",
    cookie: customerCookie,
    body: checkoutBody(),
  });
  assert.equal(retry.body.id, order.id);
  assert.equal(
    one(db, "SELECT stock FROM products WHERE id=?", product.id).stock,
    before - 2,
  );
  assert.equal(
    (
      await request("/orders", {
        method: "POST",
        cookie: customerCookie,
        body: {
          ...checkoutBody(),
          items: [{ product_id: product.id, quantity: 1 }],
        },
      })
    ).status,
    409,
  );
});
test("private orders are inaccessible to other customers or guests", async () => {
  assert.equal((await request("/orders/" + order.id)).status, 404);
  assert.equal(
    (await request("/orders/" + order.id, { cookie: adminCookie })).status,
    404,
  );
  assert.equal(
    (await request("/orders/" + order.id, { cookie: customerCookie })).status,
    200,
  );
  assert.equal(
    (await request("/orders/" + order.id + "?token=" + order.access_token))
      .status,
    200,
  );
});
test("cancellation restores inventory once, no invalid transition", async () => {
  const before = one(
    db,
    "SELECT stock FROM products WHERE id=?",
    product.id,
  ).stock;
  const r = await request("/admin/orders/" + order.id, {
    method: "PATCH",
    cookie: adminCookie,
    body: { status: "Cancelado" },
  });
  assert.equal(r.status, 200);
  assert.equal(
    one(db, "SELECT stock FROM products WHERE id=?", product.id).stock,
    before + 2,
  );
  await request("/admin/orders/" + order.id, {
    method: "PATCH",
    cookie: adminCookie,
    body: { status: "Cancelado" },
  });
  assert.equal(
    one(db, "SELECT stock FROM products WHERE id=?", product.id).stock,
    before + 2,
  );
  assert.equal(
    (
      await request("/admin/orders/" + order.id, {
        method: "PATCH",
        cookie: adminCookie,
        body: { status: "Enviado" },
      })
    ).status,
    409,
  );
});
test("coupons validated and applied using integer cents", async () => {
  const c = await request("/admin/coupons", {
    method: "POST",
    cookie: adminCookie,
    body: {
      code: "TEST10",
      kind: "percent",
      value: 10,
      min_total: 100,
      max_uses: 1,
      active: true,
    },
  });
  assert.equal(c.status, 200);
  const q = await request("/quote", {
    method: "POST",
    body: {
      items: [{ product_id: product.id, quantity: 1 }],
      coupon: "test10",
    },
  });
  assert.equal(q.body.discount, 185);
  const bad = await request("/quote", {
    method: "POST",
    body: {
      items: [{ product_id: product.id, quantity: 1 }],
      coupon: "INVALID",
    },
  });
  assert.equal(bad.status, 400);
});
test("inventory cannot go negative", async () => {
  const r = await request("/admin/inventory", {
    method: "POST",
    cookie: adminCookie,
    body: { product_id: product.id, quantity: -999, reason: "QA" },
  });
  assert.equal(r.status, 409);
});
test("product CRUD, resources, variants and stock isolation", async () => {
  const body = {
    name: "Producto QA",
    slug: "producto-qa",
    sku: "QA-001",
    price: 1000,
    stock: 5,
    active: true,
    details: { voltage: "5 V" },
    images: [{ url: "/assets/uno.png", kind: "image" }],
    resources: [
      {
        title: "Manual",
        kind: "Manual PDF",
        url: "https://example.com/manual.pdf",
      },
    ],
    variants: [{ name: "Azul", sku: "QA-BLUE", price: 1200, stock: 3 }],
  };
  const r = await request("/admin/products", {
    method: "POST",
    cookie: adminCookie,
    body,
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const p = r.body;
  assert.equal(p.resources.length, 1);
  const q = await request("/quote", {
    method: "POST",
    body: {
      items: [{ product_id: p.id, variant_id: p.variants[0].id, quantity: 2 }],
    },
  });
  assert.equal(q.body.total, 2400);
  assert.equal(
    (
      await request("/quote", {
        method: "POST",
        body: { items: [{ product_id: p.id, quantity: 1 }] },
      })
    ).status,
    400,
  );
  const update = await request("/admin/products/" + p.id, {
    method: "PUT",
    cookie: adminCookie,
    body: { ...p, stock: 999 },
  });
  assert.equal(update.body.stock, 5);
  const duplicate = await request("/admin/products/" + p.id + "/duplicate", {
    method: "POST",
    cookie: adminCookie,
    body: {},
  });
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.active, 0);
  assert.equal(duplicate.body.variants[0].stock, 0);
  assert.equal(
    (
      await request("/admin/products/" + p.id, {
        method: "DELETE",
        cookie: adminCookie,
        body: {},
      })
    ).status,
    200,
  );
});
test("inquiry, content and admin settings stored", async () => {
  assert.equal(
    (
      await request("/inquiries", {
        method: "POST",
        body: {
          name: "QA Institución",
          email: "qa@example.test",
          organization: "Institución QA",
          kind: "Laboratorio",
          message: "Solicitud de prueba",
        },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/admin/inquiries", { cookie: adminCookie })).body.length,
    1,
  );
  const r = await request("/admin/settings", {
    method: "PUT",
    cookie: adminCookie,
    body: { heroTitle: "Una idea de prueba." },
  });
  assert.equal(r.body.heroTitle, "Una idea de prueba.");
  assert.equal(
    (
      await request("/admin/settings", {
        method: "PUT",
        cookie: adminCookie,
        body: { demo: false },
      })
    ).status,
    400,
  );
});
test("payment online never silently succeeds", async () => {
  const r = await request("/orders", {
    method: "POST",
    body: {
      ...checkoutBody(),
      payment_method: "online",
      idempotency: "qa-online-not-configured-12345",
    },
  });
  assert.equal(r.status, 503);
});
test("concurrent last-unit orders never oversell", async () => {
  db.prepare("UPDATE products SET stock=1 WHERE id=?").run(product.id);
  const body = {
    ...checkoutBody(),
    items: [{ product_id: product.id, quantity: 1 }],
  };
  const results = await Promise.all(
    ["a", "b"].map((s) =>
      request("/orders", {
        method: "POST",
        body: { ...body, idempotency: "concurrent-last-unit-order-" + s },
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    one(db, "SELECT stock FROM products WHERE id=?", product.id).stock,
    0,
  );
});
test("private invoice PDF is restricted to owner and order staff", async () => {
  const invoice = {
    name: "factura-qa.pdf",
    data: Buffer.from("%PDF-1.4\nQA test invoice\n%%EOF").toString("base64"),
  };
  assert.equal(
    (
      await request("/admin/orders/" + order.id + "/invoice", {
        method: "POST",
        cookie: customerCookie,
        body: invoice,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/admin/orders/" + order.id + "/invoice", {
        method: "POST",
        cookie: adminCookie,
        body: invoice,
      })
    ).status,
    200,
  );
  assert.equal((await request("/orders/" + order.id + "/invoice")).status, 401);
  assert.equal(
    (
      await request("/orders/" + order.id + "/invoice", {
        cookie: customerCookie,
      })
    ).body.data,
    invoice.data,
  );
  assert.equal(
    (await request("/orders/" + order.id, { cookie: customerCookie })).body
      .has_invoice,
    true,
  );
});
test("uploads reject executable content and unauthorized users", async () => {
  const body = {
    name: "malicious.html",
    data: Buffer.from("<script>alert(1)</script>").toString("base64"),
  };
  assert.equal(
    (await request("/admin/uploads", { method: "POST", body })).status,
    401,
  );
  assert.equal(
    (
      await request("/admin/uploads", {
        method: "POST",
        body,
        cookie: customerCookie,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/admin/uploads", {
        method: "POST",
        body,
        cookie: adminCookie,
      })
    ).status,
    400,
  );
});
test("malformed CMS arrays and product details are rejected", async () => {
  assert.equal(
    (
      await request("/admin/settings", {
        method: "PUT",
        cookie: adminCookie,
        body: { faq: { unexpected: true } },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/admin/settings", {
        method: "PUT",
        cookie: adminCookie,
        body: { homeSections: ["unknown"] },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/admin/products", {
        method: "POST",
        cookie: adminCookie,
        body: {
          name: "Invalid",
          slug: "invalid",
          sku: "BAD",
          price: 1,
          details: { features: "not an array" },
        },
      })
    ).status,
    400,
  );
});
test("SEO, security headers and 404 responses", async () => {
  const r = await fetch(base + "/productos/arduino-uno-r3");
  const html = await r.text();
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /"@type":"Product"/);
  assert.ok(
    r.headers.get("content-security-policy").includes("frame-ancestors 'none'"),
  );
  assert.equal((await fetch(base + "/does-not-exist")).status, 404);
  assert.match(
    await (await fetch(base + "/sitemap.xml")).text(),
    /arduino-uno-r3/,
  );
  assert.equal((await fetch(base + "/src/server.js")).status, 404);
});
