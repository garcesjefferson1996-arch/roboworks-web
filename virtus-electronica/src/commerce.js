import { id, one, all, settings, transaction } from "./db.js";
import { fail, str, integer, email, hash, token } from "./security.js";
export const states = [
  "Pedido recibido",
  "Pago pendiente",
  "Pago confirmado",
  "Preparando pedido",
  "Enviado",
  "Entregado",
  "Cancelado",
];
export function quote(db, input) {
  if (
    !Array.isArray(input.items) ||
    !input.items.length ||
    input.items.length > 100
  )
    fail(400, "El carrito debe contener entre 1 y 100 productos.");
  const seen = new Set();
  const items = input.items.map((line) => {
    const p = one(
      db,
      "SELECT * FROM products WHERE id=? AND active=1",
      str(line.product_id, "Producto"),
    );
    if (!p) fail(409, "Un producto ya no está disponible.");
    const variant = line.variant_id
      ? one(
          db,
          "SELECT * FROM variants WHERE id=? AND product_id=?",
          str(line.variant_id, "Variante"),
          p.id,
        )
      : null;
    if (line.variant_id && !variant) fail(400, "Variante inválida.");
    if (!variant && one(db, "SELECT id FROM variants WHERE product_id=?", p.id))
      fail(400, `Selecciona una variante de ${p.name}.`);
    const key = p.id + ":" + (variant?.id || "");
    if (seen.has(key)) fail(400, "Hay líneas duplicadas.");
    seen.add(key);
    const quantity = integer(line.quantity, "Cantidad", 1, 1000);
    const source = variant || p;
    if (source.stock < quantity || ["coming", "on_order"].includes(p.status))
      fail(409, `Stock insuficiente: ${p.name}.`);
    let price = source.price;
    const details = JSON.parse(p.details);
    for (const tier of [...(details.quantityDiscounts || [])].sort(
      (a, b) => a.quantity - b.quantity,
    ))
      if (quantity >= tier.quantity)
        price = Math.round((source.price * (100 - tier.percent)) / 100);
    return {
      product_id: p.id,
      variant_id: variant?.id || null,
      name: p.name + (variant ? ` · ${variant.name}` : ""),
      sku: source.sku,
      quantity,
      price,
      image:
        one(
          db,
          "SELECT url FROM media WHERE product_id=? AND kind='image' ORDER BY position LIMIT 1",
          p.id,
        )?.url || "",
      demo: p.demo,
    };
  });
  const subtotal = items.reduce((sum, p) => sum + p.price * p.quantity, 0),
    config = settings(db);
  let coupon = null,
    discount = 0;
  if (input.coupon) {
    coupon = one(
      db,
      "SELECT * FROM coupons WHERE code=? AND active=1",
      str(input.coupon, "Cupón", 40),
    );
    const now = new Date().toISOString().slice(0, 10);
    if (
      !coupon ||
      coupon.uses >= coupon.max_uses ||
      (coupon.starts_at && coupon.starts_at > now) ||
      (coupon.ends_at && coupon.ends_at < now) ||
      subtotal < coupon.min_total
    )
      fail(
        400,
        "El cupón no está disponible o no alcanza el mínimo de compra.",
      );
    discount =
      coupon.kind === "percent"
        ? Math.round((subtotal * coupon.value) / 100)
        : coupon.value;
    discount = Math.min(discount, subtotal);
  }
  const delivery = input.delivery || "pickup";
  if (!["pickup", "shipping"].includes(delivery))
    fail(400, "Entrega inválida.");
  if (
    (delivery === "pickup" && !config.pickupEnabled) ||
    (delivery === "shipping" && !config.shippingEnabled)
  )
    fail(400, "Método de entrega no disponible.");
  const shipping =
    delivery === "shipping" && subtotal - discount < config.freeShipping
      ? config.shipping
      : 0;
  return {
    items,
    subtotal,
    discount,
    shipping,
    total: subtotal - discount + shipping,
    coupon,
    delivery,
  };
}
export function createOrder(db, input, user) {
  const key = str(input.idempotency, "Identificador de compra", 100);
  if (!/^[a-zA-Z0-9-]{20,100}$/.test(key)) fail(400, "Identificador inválido.");
  const digest = hash(JSON.stringify({ ...input, idempotency: undefined }));
  const previous = one(db, "SELECT * FROM orders WHERE idempotency=?", key);
  if (previous) {
    if (
      previous.request_hash !== digest ||
      previous.user_id !== (user?.id || null)
    )
      fail(409, "Esta compra ya fue procesada con otros datos.");
    return orderDetails(db, previous);
  }
  const c = input.customer || {};
  const customer = {
    name: str(c.name, "Nombre", 150),
    email: email(c.email),
    phone: str(c.phone, "Teléfono", 30),
    city: str(c.city, "Ciudad", 100),
    province: str(c.province, "Provincia", 100),
    address: str(
      c.address || "",
      "Dirección",
      500,
      input.delivery === "shipping",
    ),
    document: str(c.document || "", "Identificación", 30, false),
  };
  if (!/^[+\d ()-]{7,30}$/.test(customer.phone))
    fail(400, "Ingresa un teléfono válido.");
  if (user && customer.email !== user.email)
    fail(400, "Utiliza el correo de tu cuenta para asociar el pedido.");
  const config = settings(db);
  if (
    !config.demo &&
    (!config.businessName || !config.email || !config.privacy || !config.legal)
  )
    fail(
      503,
      "La tienda está preparando sus condiciones comerciales. Contacta con nuestro equipo para una cotización.",
    );
  const method = input.payment_method;
  if (method === "online")
    fail(503, "El pago online todavía no está configurado.");
  if (
    !["transfer", "pickup"].includes(method) ||
    (method === "transfer" && !config.transferEnabled) ||
    (method === "pickup" && input.delivery !== "pickup")
  )
    fail(400, "Método de pago no disponible.");
  if (!input.accepted)
    fail(400, "Debes aceptar las condiciones de compra y privacidad.");
  return transaction(db, () => {
    const q = quote(db, input),
      oid = id(),
      access = token(),
      number =
        "VE-" +
        Date.now().toString(36).toUpperCase() +
        "-" +
        token().slice(0, 4).toUpperCase();
    db.prepare(
      "INSERT INTO orders(id,number,user_id,email,customer,subtotal,discount,shipping,total,coupon_id,delivery,payment_method,idempotency,request_hash,access_token,demo) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      oid,
      number,
      user?.id || null,
      customer.email,
      JSON.stringify(customer),
      q.subtotal,
      q.discount,
      q.shipping,
      q.total,
      q.coupon?.id || null,
      q.delivery,
      method,
      key,
      digest,
      access,
      config.demo || q.items.some((p) => p.demo) ? 1 : 0,
    );
    for (const p of q.items) {
      const table = p.variant_id ? "variants" : "products",
        pid = p.variant_id || p.product_id;
      const change = db
        .prepare(`UPDATE ${table} SET stock=stock-? WHERE id=? AND stock>=?`)
        .run(p.quantity, pid, p.quantity);
      if (!change.changes) fail(409, "El stock cambió. Revisa tu carrito.");
      db.prepare("INSERT INTO order_items VALUES(?,?,?,?,?,?,?,?,?)").run(
        id(),
        oid,
        p.product_id,
        p.variant_id,
        p.name,
        p.sku,
        p.quantity,
        p.price,
        p.image,
      );
      db.prepare(
        "INSERT INTO inventory_movements(id,product_id,variant_id,quantity,reason,actor_id,order_id) VALUES(?,?,?,?,?,?,?)",
      ).run(
        id(),
        p.product_id,
        p.variant_id,
        -p.quantity,
        "Reserva de pedido",
        user?.id || null,
        oid,
      );
    }
    if (q.coupon)
      db.prepare("UPDATE coupons SET uses=uses+1 WHERE id=?").run(q.coupon.id);
    db.prepare(
      "INSERT INTO payments(id,order_id,provider,amount) VALUES(?,?,?,?)",
    ).run(id(), oid, method, q.total);
    db.prepare(
      "INSERT INTO order_history(id,order_id,status,actor_id) VALUES(?,?,?,?)",
    ).run(id(), oid, "Pago pendiente", user?.id || null);
    return orderDetails(db, one(db, "SELECT * FROM orders WHERE id=?", oid));
  });
}
export function orderDetails(db, o) {
  return {
    ...o,
    request_hash: undefined,
    idempotency: undefined,
    has_invoice: !!one(
      db,
      "SELECT order_id FROM invoices WHERE order_id=?",
      o.id,
    ),
    customer: JSON.parse(o.customer),
    items: all(db, "SELECT * FROM order_items WHERE order_id=?", o.id),
    history: all(
      db,
      "SELECT status,created_at FROM order_history WHERE order_id=? ORDER BY created_at",
      o.id,
    ),
    payments: all(
      db,
      "SELECT provider,status,reference,amount FROM payments WHERE order_id=?",
      o.id,
    ),
  };
}
export function updateOrder(db, oid, status, user) {
  if (!states.includes(status)) fail(400, "Estado inválido.");
  return transaction(db, () => {
    const o = one(db, "SELECT * FROM orders WHERE id=?", oid);
    if (!o) fail(404, "Pedido no encontrado.");
    if (status === o.status) return orderDetails(db, o);
    const allowed = {
      "Pedido recibido": ["Pago pendiente", "Cancelado"],
      "Pago pendiente": ["Pago confirmado", "Cancelado"],
      "Pago confirmado": ["Preparando pedido", "Cancelado"],
      "Preparando pedido": ["Enviado", "Entregado", "Cancelado"],
      Enviado: ["Entregado"],
      Entregado: [],
      Cancelado: [],
    };
    if (!allowed[o.status].includes(status))
      fail(409, "Transición de estado no permitida.");
    if (status === "Cancelado") {
      for (const p of all(
        db,
        "SELECT * FROM order_items WHERE order_id=?",
        oid,
      )) {
        db.prepare(
          `UPDATE ${p.variant_id ? "variants" : "products"} SET stock=stock+? WHERE id=?`,
        ).run(p.quantity, p.variant_id || p.product_id);
        db.prepare(
          "INSERT INTO inventory_movements(id,product_id,variant_id,quantity,reason,actor_id,order_id) VALUES(?,?,?,?,?,?,?)",
        ).run(
          id(),
          p.product_id,
          p.variant_id,
          p.quantity,
          "Cancelación",
          user.id,
          oid,
        );
      }
      if (o.coupon_id)
        db.prepare("UPDATE coupons SET uses=MAX(0,uses-1) WHERE id=?").run(
          o.coupon_id,
        );
      db.prepare(
        "UPDATE payments SET status=CASE WHEN status='confirmed' THEN 'refund_required' ELSE 'cancelled' END WHERE order_id=?",
      ).run(oid);
    }
    if (status === "Pago confirmado")
      db.prepare("UPDATE payments SET status='confirmed' WHERE order_id=?").run(
        oid,
      );
    db.prepare("UPDATE orders SET status=? WHERE id=?").run(status, oid);
    db.prepare(
      "INSERT INTO order_history(id,order_id,status,actor_id) VALUES(?,?,?,?)",
    ).run(id(), oid, status, user.id);
    return orderDetails(db, one(db, "SELECT * FROM orders WHERE id=?", oid));
  });
}
