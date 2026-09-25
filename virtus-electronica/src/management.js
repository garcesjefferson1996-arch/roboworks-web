import { id, all, one, transaction } from "./db.js";
import { fail, str, integer, hash } from "./security.js";

const pick = (value, choices) => {
  if (!choices.includes(value)) fail(400, "Opción inválida.");
  return value;
};
function day(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    fail(400, "Fecha inválida.");
  return value;
}
const optional = (v, label, max = 2000) => str(v ?? "", label, max, false);
const outstanding = (db, r) =>
  r.total -
  one(
    db,
    "SELECT COALESCE(SUM(amount),0) AS paid FROM mg_entries WHERE record_id=? AND void_reason=''",
    r.id,
  ).paid;
const audit = (db, user, action, target) =>
  db
    .prepare("INSERT INTO audit(id,actor_id,action,target) VALUES(?,?,?,?)")
    .run(id(), user.id, action, target);

export function management(db, req, url, b, user) {
  const route = url.pathname.replace("/api/management", ""),
    method = req.method;
  if (route === "" && method === "GET") {
    const accounts = all(
      db,
      `SELECT a.*, a.opening + COALESCE((SELECT SUM(CASE WHEN e.account_id=a.id THEN CASE WHEN e.kind='income' THEN e.amount ELSE -e.amount END ELSE e.amount END) FROM mg_entries e WHERE (e.account_id=a.id OR e.to_account_id=a.id) AND e.void_reason=''),0) AS balance FROM mg_accounts a ORDER BY a.created_at,a.rowid`,
    );
    return {
      accounts,
      entries: all(
        db,
        "SELECT * FROM mg_entries ORDER BY day DESC,created_at DESC,rowid DESC",
      ),
      records: all(
        db,
        `SELECT r.*, COALESCE((SELECT SUM(amount) FROM mg_entries e WHERE e.record_id=r.id AND e.void_reason=''),0) AS paid FROM mg_records r ORDER BY created_at DESC,rowid DESC`,
      ),
      assets: all(db, "SELECT * FROM mg_assets ORDER BY name"),
      products: all(
        db,
        "SELECT id,name,sku,price,stock,min_stock,demo FROM products WHERE active=1 ORDER BY name",
      ),
      variants: all(
        db,
        "SELECT v.* FROM variants v JOIN products p ON p.id=v.product_id WHERE p.active=1 ORDER BY v.name",
      ),
    };
  }
  if (method === "POST" && route === "/accounts") {
    const aid = id();
    transaction(db, () => {
      db.prepare(
        "INSERT INTO mg_accounts(id,name,scope,opening) VALUES(?,?,?,?)",
      ).run(
        aid,
        str(b.name, "Nombre", 100),
        pick(b.scope, ["business", "personal"]),
        integer(b.opening ?? 0, "Saldo inicial", -100000000),
      );
      audit(db, user, "management.account.create", aid);
    });
    return { id: aid };
  }
  if (method === "POST" && route === "/assets") {
    const aid = id();
    transaction(db, () => {
      db.prepare("INSERT INTO mg_assets(id,name,serial) VALUES(?,?,?)").run(
        aid,
        str(b.name, "Robot", 120),
        optional(b.serial, "Identificador", 120),
      );
      audit(db, user, "management.asset.create", aid);
    });
    return { id: aid };
  }
  if (method === "POST" && route === "/records")
    return transaction(db, () => {
      const requestKey = str(b.request_key, "Identificador", 100);
      const digest = hash(JSON.stringify(b));
      const previous = one(
        db,
        "SELECT * FROM mg_requests WHERE request_key=?",
        requestKey,
      );
      if (previous) {
        if (previous.digest !== digest)
          fail(409, "Identificador usado con otros datos.");
        return { id: previous.record_id };
      }
      const rid = id(),
        kind = pick(b.kind, ["sale", "service", "rental", "payable"]);
      let total = integer(b.total, "Total", 1),
        asset = null,
        starts = null,
        ends = null,
        lines = [];
      if (kind === "rental") {
        asset = one(
          db,
          "SELECT * FROM mg_assets WHERE id=?",
          str(b.asset_id, "Robot"),
        );
        if (!asset) fail(400, "Selecciona un robot registrado.");
        starts = day(b.starts);
        ends = day(b.ends);
        if (ends < starts)
          fail(400, "La devolución no puede ser anterior a la entrega.");
        if (
          one(
            db,
            "SELECT id FROM mg_records WHERE asset_id=? AND status NOT IN ('cancelled','done') AND starts<=? AND ends>=?",
            asset.id,
            ends,
            starts,
          )
        )
          fail(409, "Ese robot ya tiene una reserva en esas fechas.");
      }
      if (kind === "sale") {
        if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 50)
          fail(400, "Añade de 1 a 50 productos.");
        const seen = new Set();
        lines = b.lines.map((l) => {
          const p = one(
            db,
            "SELECT * FROM products WHERE id=? AND active=1",
            str(l.product_id, "Producto"),
          );
          if (!p || p.demo)
            fail(
              400,
              "Selecciona productos reales, sin marca de demostración.",
            );
          const v = l.variant_id
            ? one(
                db,
                "SELECT * FROM variants WHERE id=? AND product_id=?",
                str(l.variant_id, "Variante"),
                p.id,
              )
            : null;
          if (
            (l.variant_id && !v) ||
            (!v && one(db, "SELECT id FROM variants WHERE product_id=?", p.id))
          )
            fail(400, "Selecciona una variante válida.");
          const key = v?.id || p.id;
          if (seen.has(key))
            fail(400, "Combina las cantidades del mismo producto.");
          seen.add(key);
          const quantity = integer(l.quantity, "Cantidad", 1, 10000),
            item = v || p;
          if (quantity > item.stock) fail(409, "Stock insuficiente: " + p.name);
          return {
            product_id: p.id,
            variant_id: v?.id || null,
            name: p.name + (v ? " · " + v.name : ""),
            quantity,
            price: item.price,
          };
        });
        total = integer(
          lines.reduce((s, l) => s + l.quantity * l.price, 0),
          "Total",
          1,
        );
      }
      db.prepare(
        "INSERT INTO mg_records(id,kind,title,contact,phone,total,cost,due,asset_id,starts,ends,notes,actor_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
      ).run(
        rid,
        kind,
        str(b.title, "Concepto", 200),
        str(b.contact, "Cliente o proveedor", 150),
        optional(b.phone, "Teléfono", 50),
        total,
        integer(b.cost ?? 0, "Costo estimado"),
        day(b.due),
        asset?.id || null,
        starts,
        ends,
        optional(b.notes, "Notas"),
        user.id,
      );
      for (const l of lines) {
        db.prepare("INSERT INTO mg_lines VALUES(?,?,?,?,?,?,?)").run(
          id(),
          rid,
          l.product_id,
          l.variant_id,
          l.name,
          l.quantity,
          l.price,
        );
        db.prepare(
          `UPDATE ${l.variant_id ? "variants" : "products"} SET stock=stock-? WHERE id=?`,
        ).run(l.quantity, l.variant_id || l.product_id);
        db.prepare(
          "INSERT INTO inventory_movements(id,product_id,variant_id,quantity,reason,actor_id) VALUES(?,?,?,?,?,?)",
        ).run(
          id(),
          l.product_id,
          l.variant_id,
          -l.quantity,
          "Venta interna " + rid,
          user.id,
        );
      }
      audit(db, user, "management.record.create", rid);
      db.prepare("INSERT INTO mg_requests VALUES(?,?,?)").run(
        requestKey,
        digest,
        rid,
      );
      return { id: rid };
    });
  if (method === "POST" && route === "/entries")
    return transaction(db, () => {
      const key = str(b.request_key, "Identificador", 100);
      const previous = one(
        db,
        "SELECT * FROM mg_entries WHERE request_key=?",
        key,
      );
      if (previous) {
        const fields = [
          "account_id",
          "kind",
          "amount",
          "category",
          "description",
          "day",
        ];
        if (
          fields.some((k) => previous[k] !== b[k]) ||
          previous.record_id !== (b.record_id || null) ||
          previous.to_account_id !== (b.to_account_id || null)
        )
          fail(409, "Identificador usado con otros datos.");
        return { id: previous.id };
      }
      const aid = str(b.account_id, "Cuenta"),
        a = one(db, "SELECT * FROM mg_accounts WHERE id=?", aid);
      if (!a) fail(400, "Selecciona una cuenta válida.");
      const kind = pick(b.kind, ["income", "expense", "transfer"]),
        amount = integer(b.amount, "Importe", 1);
      let dest = null,
        record = null;
      if (kind === "transfer") {
        dest = str(b.to_account_id, "Cuenta destino");
        if (
          dest === aid ||
          !one(db, "SELECT id FROM mg_accounts WHERE id=?", dest)
        )
          fail(400, "Elige otra cuenta de destino.");
        if (b.record_id) fail(400, "Una transferencia no paga un trabajo.");
      }
      if (b.record_id) {
        record = one(
          db,
          "SELECT * FROM mg_records WHERE id=?",
          str(b.record_id, "Operación"),
        );
        if (!record || record.status === "cancelled")
          fail(400, "Operación no disponible.");
        if (
          a.scope !== "business" ||
          kind !== (record.kind === "payable" ? "expense" : "income")
        )
          fail(
            400,
            "Usa una cuenta del negocio y el tipo de movimiento correcto.",
          );
        if (amount > outstanding(db, record))
          fail(409, "El importe supera el saldo pendiente.");
      }
      const eid = id();
      db.prepare(
        "INSERT INTO mg_entries(id,request_key,account_id,to_account_id,kind,amount,category,description,day,record_id,actor_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      ).run(
        eid,
        key,
        aid,
        dest,
        kind,
        amount,
        str(b.category, "Categoría", 100),
        str(b.description, "Descripción", 250),
        day(b.day),
        record?.id || null,
        user.id,
      );
      audit(db, user, "management.entry.create", eid);
      return { id: eid };
    });
  const voidMatch = route.match(/^\/entries\/([^/]+)\/void$/);
  if (method === "POST" && voidMatch)
    return transaction(db, () => {
      const entry = one(
        db,
        "SELECT * FROM mg_entries WHERE id=?",
        voidMatch[1],
      );
      if (!entry) fail(404, "Movimiento no encontrado.");
      if (entry.void_reason) fail(409, "Movimiento ya anulado.");
      db.prepare("UPDATE mg_entries SET void_reason=? WHERE id=?").run(
        str(b.reason, "Motivo", 250),
        entry.id,
      );
      audit(db, user, "management.entry.void", entry.id);
      return { ok: true };
    });
  const stateMatch = route.match(/^\/records\/([^/]+)$/);
  if (method === "PATCH" && stateMatch)
    return transaction(db, () => {
      const r = one(db, "SELECT * FROM mg_records WHERE id=?", stateMatch[1]);
      if (!r) fail(404, "Operación no encontrada.");
      const status = pick(b.status, ["active", "done", "cancelled"]);
      if (r.status === status) return { ok: true };
      if (["done", "cancelled"].includes(r.status))
        fail(409, "La operación ya está cerrada.");
      if (status === "cancelled") {
        if (outstanding(db, r) !== r.total)
          fail(
            409,
            "Primero devuelve el dinero y anula sus cobros o pagos con un motivo.",
          );
        for (const l of all(
          db,
          "SELECT * FROM mg_lines WHERE record_id=?",
          r.id,
        )) {
          db.prepare(
            `UPDATE ${l.variant_id ? "variants" : "products"} SET stock=stock+? WHERE id=?`,
          ).run(l.quantity, l.variant_id || l.product_id);
          db.prepare(
            "INSERT INTO inventory_movements(id,product_id,variant_id,quantity,reason,actor_id) VALUES(?,?,?,?,?,?)",
          ).run(
            id(),
            l.product_id,
            l.variant_id,
            l.quantity,
            "Cancelación venta interna " + r.id,
            user.id,
          );
        }
      }
      db.prepare("UPDATE mg_records SET status=? WHERE id=?").run(status, r.id);
      audit(db, user, "management.record." + status, r.id);
      return { ok: true };
    });
  fail(404, "Ruta de gestión no encontrada.");
}
