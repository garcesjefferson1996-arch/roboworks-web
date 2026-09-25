import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { openDb, id, one } from "../src/db.js";
import { createApp } from "../src/server.js";
import { hash } from "../src/security.js";

const db = openDb(":memory:");
let server, base, business, personal, record, payment, asset, sale, variantSale;
const owner = id(),
  customer = id(),
  staff = id(),
  product = id(),
  variantProduct = id(),
  variant = id();
const origin = "http://localhost:3121";
before(async () => {
  for (const [uid, role, token] of [
    [owner, "super_admin", "owner-token"],
    [customer, "customer", "customer-token"],
    [staff, "admin", "staff-token"],
  ]) {
    db.prepare(
      "INSERT INTO users(id,name,email,password,role) VALUES(?,?,?,?,?)",
    ).run(uid, role, uid + "@example.test", "unused", role);
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      hash(token),
      uid,
      Date.now() + 600000,
    );
  }
  db.prepare(
    "INSERT INTO products(id,slug,sku,name,price,stock) VALUES(?,?,?,?,?,?)",
  ).run(product, "test-filament", "PLA-1", "Filamento PLA", 2200, 5);
  db.prepare(
    "INSERT INTO products(id,slug,sku,name,price,stock) VALUES(?,?,?,?,?,?)",
  ).run(variantProduct, "test-board", "BOARD", "Arduino", 1500, 0);
  db.prepare("INSERT INTO variants VALUES(?,?,?,?,?,?)").run(
    variant,
    variantProduct,
    "Azul",
    "BOARD-B",
    1700,
    3,
  );
  server = createApp(db, { origin });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = "http://127.0.0.1:" + server.address().port;
});
after(async () => {
  await new Promise((r) => server.close(r));
  db.close();
});
async function request(
  path = "",
  body,
  method = "POST",
  token = "owner-token",
  requestOrigin = origin,
) {
  const r = await fetch(base + "/api/management" + path, {
    method: body ? method : "GET",
    headers: {
      Cookie: "virtus_session=" + token,
      Origin: requestOrigin,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json() };
}
const entry = (overrides = {}) => ({
  request_key: id(),
  account_id: business,
  kind: "income",
  amount: 1000,
  category: "Impresión 3D",
  description: "Abono",
  day: "2026-09-24",
  ...overrides,
});
const operation = (overrides = {}) => ({
  request_key: id(),
  kind: "service",
  title: "Pieza PLA",
  contact: "Cliente QA",
  total: 10000,
  cost: 2500,
  due: "2026-09-30",
  ...overrides,
});
test("financial data is private to owner, including normal administrators; CSRF protected", async () => {
  assert.equal((await request("", undefined, "GET", "missing")).status, 401);
  assert.equal(
    (await request("", undefined, "GET", "customer-token")).status,
    403,
  );
  assert.equal(
    (await request("", undefined, "GET", "staff-token")).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/accounts",
        { name: "Caja", scope: "business", opening: 0 },
        "POST",
        "owner-token",
        "http://evil.test",
      )
    ).status,
    403,
  );
});
test("business and personal opening balances remain separate", async () => {
  business = (
    await request("/accounts", {
      name: "Caja",
      scope: "business",
      opening: 10000,
    })
  ).body.id;
  personal = (
    await request("/accounts", {
      name: "Personal",
      scope: "personal",
      opening: 2000,
    })
  ).body.id;
  const r = await request();
  assert.equal(r.body.accounts.find((a) => a.id === business).balance, 10000);
  assert.equal(r.body.accounts.find((a) => a.id === personal).balance, 2000);
});
test("transfer changes both balances once and never creates operating income", async () => {
  const b = entry({ kind: "transfer", to_account_id: personal, amount: 3000 });
  const first = await request("/entries", b);
  assert.equal(first.status, 200);
  assert.equal((await request("/entries", b)).body.id, first.body.id);
  assert.equal((await request("/entries", { ...b, amount: 4000 })).status, 409);
  const r = (await request()).body;
  assert.equal(r.accounts.find((a) => a.id === business).balance, 7000);
  assert.equal(r.accounts.find((a) => a.id === personal).balance, 5000);
  assert.equal(r.entries.filter((e) => e.kind === "income").length, 0);
  assert.equal(
    (
      await request(
        "/entries",
        entry({ kind: "transfer", to_account_id: business }),
      )
    ).status,
    400,
  );
});
test("receivables support partial payments and reject excess or personal-account payments", async () => {
  record = (await request("/records", operation())).body.id;
  payment = (
    await request("/entries", entry({ record_id: record, amount: 4000 }))
  ).body.id;
  assert.equal(
    (await request()).body.records.find((r) => r.id === record).paid,
    4000,
  );
  assert.equal(
    (await request("/entries", entry({ record_id: record, amount: 6001 })))
      .status,
    409,
  );
  assert.equal(
    (
      await request(
        "/entries",
        entry({ record_id: record, account_id: personal }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await request("/entries", entry({ record_id: record, kind: "expense" })))
      .status,
    400,
  );
  assert.equal(
    (await request("/records/" + record, { status: "cancelled" }, "PATCH"))
      .status,
    409,
  );
});
test("voiding preserves audit and reopens receivable; cannot void twice", async () => {
  assert.equal(
    (
      await request("/entries/" + payment + "/void", {
        reason: "Cliente recibió devolución; abono equivocado",
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/entries/" + payment + "/void", { reason: "otra" })).status,
    409,
  );
  const d = (await request()).body;
  assert.equal(d.records.find((r) => r.id === record).paid, 0);
  assert.ok(d.entries.find((e) => e.id === payment).void_reason);
  assert.equal(d.accounts.find((a) => a.id === business).balance, 7000);
  assert.ok(
    one(
      db,
      "SELECT id FROM audit WHERE action='management.entry.void' AND target=?",
      payment,
    ),
  );
});
test("rental reservations reject overlapping and invalid dates", async () => {
  asset = (await request("/assets", { name: "Unitree Go2", serial: "01" })).body
    .id;
  const b = operation({
    kind: "rental",
    asset_id: asset,
    starts: "2026-10-01",
    ends: "2026-10-03",
  });
  const r = await request("/records", b);
  assert.equal(r.status, 200);
  assert.equal(
    (
      await request("/records", {
        ...b,
        request_key: id(),
        starts: "2026-10-03",
        ends: "2026-10-05",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/records", {
        ...b,
        request_key: id(),
        starts: "2026-02-30",
        ends: "2026-03-01",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/records", {
        ...b,
        request_key: id(),
        starts: "2026-10-06",
        ends: "2026-10-05",
      })
    ).status,
    400,
  );
  await request("/records/" + r.body.id, { status: "cancelled" }, "PATCH");
  assert.equal(
    (await request("/records", { ...b, request_key: id() })).status,
    200,
  );
});
test("point of sale calculates authoritative prices and deducts shared inventory", async () => {
  const body = operation({
    kind: "sale",
    total: 1,
    lines: [{ product_id: product, quantity: 2, price: 1 }],
  });
  const r = await request("/records", body);
  assert.equal(r.status, 200);
  sale = r.body.id;
  assert.equal((await request("/records", body)).body.id, sale);
  assert.equal(
    (await request("/records", { ...body, title: "Changed" })).status,
    409,
  );
  assert.equal(
    one(db, "SELECT total FROM mg_records WHERE id=?", sale).total,
    4400,
  );
  assert.equal(
    one(db, "SELECT stock FROM products WHERE id=?", product).stock,
    3,
  );
  assert.equal(
    (
      await request(
        "/records",
        operation({
          kind: "sale",
          lines: [{ product_id: product, quantity: 4 }],
        }),
      )
    ).status,
    409,
  );
  assert.equal(
    one(db, "SELECT stock FROM products WHERE id=?", product).stock,
    3,
  );
});
test("cancelled sales restore inventory exactly once and closed operations cannot reopen", async () => {
  assert.equal(
    (await request("/records/" + sale, { status: "cancelled" }, "PATCH"))
      .status,
    200,
  );
  assert.equal(
    (await request("/records/" + sale, { status: "cancelled" }, "PATCH"))
      .status,
    200,
  );
  assert.equal(
    one(db, "SELECT stock FROM products WHERE id=?", product).stock,
    5,
  );
  assert.equal(
    (await request("/records/" + sale, { status: "active" }, "PATCH")).status,
    409,
  );
});
test("variant stock and price used; duplicate lines and demo products rejected", async () => {
  assert.equal(
    (
      await request(
        "/records",
        operation({
          kind: "sale",
          lines: [{ product_id: variantProduct, quantity: 1 }],
        }),
      )
    ).status,
    400,
  );
  const r = await request(
    "/records",
    operation({
      kind: "sale",
      lines: [{ product_id: variantProduct, variant_id: variant, quantity: 2 }],
    }),
  );
  assert.equal(r.status, 200);
  variantSale = r.body.id;
  assert.equal(
    one(db, "SELECT total FROM mg_records WHERE id=?", variantSale).total,
    3400,
  );
  assert.equal(
    one(db, "SELECT stock FROM variants WHERE id=?", variant).stock,
    1,
  );
  await request("/records/" + variantSale, { status: "cancelled" }, "PATCH");
  assert.equal(
    one(db, "SELECT stock FROM variants WHERE id=?", variant).stock,
    3,
  );
  assert.equal(
    (
      await request(
        "/records",
        operation({
          kind: "sale",
          lines: [
            { product_id: product, quantity: 1 },
            { product_id: product, quantity: 1 },
          ],
        }),
      )
    ).status,
    400,
  );
  db.prepare("UPDATE products SET demo=1 WHERE id=?").run(product);
  assert.equal(
    (
      await request(
        "/records",
        operation({
          kind: "sale",
          lines: [{ product_id: product, quantity: 1 }],
        }),
      )
    ).status,
    400,
  );
  db.prepare("UPDATE products SET demo=0 WHERE id=?").run(product);
});
test("payables require expense payments and operational completion does not mark paid", async () => {
  const r = (await request("/records", operation({ kind: "payable" }))).body.id;
  assert.equal(
    (await request("/entries", entry({ record_id: r }))).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/entries",
        entry({ record_id: r, kind: "expense", amount: 1000 }),
      )
    ).status,
    200,
  );
  await request("/records/" + r, { status: "done" }, "PATCH");
  assert.equal(
    (await request()).body.records.find((v) => v.id === r).paid,
    1000,
  );
});
test("invalid cents, dates, and missing accounts rejected without writes", async () => {
  const count = one(db, "SELECT COUNT(*) n FROM mg_entries").n;
  for (const overrides of [
    { amount: 1.1 },
    { amount: -1 },
    { day: "2026-02-30" },
    { account_id: "missing" },
    { kind: "other" },
  ])
    assert.equal((await request("/entries", entry(overrides))).status, 400);
  assert.equal(one(db, "SELECT COUNT(*) n FROM mg_entries").n, count);
});
test("management page is served with CSP and no financial data embedded", async () => {
  const r = await fetch(base + "/gestion.html");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-security-policy"), /script-src 'self'/);
  const html = await r.text();
  assert.match(html, /noindex/);
  assert.ok(!html.includes("Cliente QA"));
});
