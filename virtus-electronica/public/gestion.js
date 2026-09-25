const $ = (s) => document.querySelector(s);
const logo =
  '<span class="virtus-logo"><img src="/assets/virtus-owner-logo.png" alt="VIRTUS"></span>';
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(
    (n || 0) / 100,
  );
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });
const cents = (s) => {
  if (!/^-?\d+(\.\d{1,2})?$/.test(String(s)))
    throw new Error("Usa importes con máximo dos decimales.");
  return Math.round(Number(s) * 100);
};
const paths = {
  home: "M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10",
  wallet: "M3 6h17v15H3zM3 6V3h14v3M16 12h5v4h-5z",
  arrows: "M3 7h17m-5-5 5 5-5 5M21 17H4m5-5-5 5 5 5",
  box: "m3 7 9-4 9 4-9 5-9-5Zm0 0v10l9 5 9-5V7M12 12v10",
  robot: "M5 8h14v12H5zM12 8V3M9 3h6M8 12v2m8-2v2M9 17h6M2 11v6m20-6v6",
  tool: "m14 3-4 4 3 4 4-4c3 5-1 9-6 7l-7 7-3-3 7-7c-2-5 2-9 6-8Z",
  chart: "M4 3v18h17M8 16v-5m5 5V7m5 9V4",
  users:
    "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m9-7a4 4 0 0 1 0 7m2 4a4 4 0 0 1 2 4v3",
  plus: "M12 5v14M5 12h14",
  down: "M12 3v17m-6-6 6 6 6-6",
  up: "M12 21V4m-6 6 6-6 6 6",
  check: "m5 12 4 4L20 5",
  clock: "M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${`<path d="${paths[name] || paths.box}"/>`}</svg>`;
const names = {
  summary: "Resumen",
  entries: "Movimientos",
  accounts: "Mis cuentas",
  sales: "Ventas",
  services: "Servicios",
  rentals: "Alquileres",
  pending: "Por cobrar y pagar",
  inventory: "Inventario",
  reports: "Reportes",
};
const kindNames = {
  sale: "Venta",
  service: "Servicio",
  rental: "Alquiler",
  payable: "Compra / obligación",
  income: "Ingreso",
  expense: "Gasto",
  transfer: "Transferencia",
};
const statusNames = {
  pending: "Pendiente",
  active: "En curso",
  done: "Completado",
  cancelled: "Cancelado",
};
let preview = false;
const previewNotice = () =>
  preview
    ? '<div class="scope-note"><b>Vista de prueba.</b> No ingreses dinero real aquí: estos datos son temporales y se borran al reiniciar. Tu sistema real está en el puerto 3100.</div>'
    : "";
let data,
  user,
  business = "VIRTUS Electrónica",
  view = "summary",
  filter = "",
  scope = "all",
  from = "",
  to = "";
async function api(path, body, method = "POST") {
  const r = await fetch("/api" + path, {
    method: body ? method : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await r.json();
  if (!r.ok)
    throw new Error(
      result.error || result.message || "No se pudo completar la operación.",
    );
  return result;
}
function notice(text) {
  $("#notice").textContent = text;
  clearTimeout(notice.timer);
  notice.timer = setTimeout(() => ($("#notice").textContent = ""), 5000);
}
const account = (id) => data.accounts.find((a) => a.id === id);
const activeEntries = () => data.entries.filter((e) => !e.void_reason);
const businessEntries = () =>
  activeEntries().filter((e) => account(e.account_id)?.scope === "business");
const sum = (rows) => rows.reduce((s, e) => s + e.amount, 0);
const balance = (s) =>
  data.accounts.filter((a) => a.scope === s).reduce((v, a) => v + a.balance, 0);
const outstanding = (r) => r.total - r.paid;
const pendingRecords = () =>
  data.records.filter((r) => r.status !== "cancelled" && outstanding(r) > 0);
const empty = (title, copy) =>
  `<div class="empty"><strong>${title}</strong>${copy}</div>`;
const button = (text, action, primary = false) =>
  `<button class="btn ${primary ? "primary" : ""}" data-action="${action}">${text}</button>`;
const metric = (label, value, hint, highlight = false, i = "wallet") =>
  `<div class="metric ${highlight ? "highlight" : ""}"><span>${label}${icon(i)}</span><strong>${value}</strong><small>${hint}</small></div>`;
const table = (heads, rows) =>
  `<div class="table-wrap"><table><thead><tr>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
const pill = (text, type = "") => `<span class="tag ${type}">${text}</span>`;
function heading(title, sub, actions = "") {
  return `<div class="page-head"><div><p class="eyebrow">TU NEGOCIO, EN ORDEN</p><h1>${title}</h1><p class="subtitle">${sub}</p></div><div class="actions">${actions}</div></div>`;
}
function chart() {
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today() + "T12:00:00");
    d.setDate(1);
    d.setMonth(d.getMonth() - 5 + i);
    const key = d.toISOString().slice(0, 7);
    const rows = businessEntries().filter((e) => e.day.startsWith(key));
    return {
      name: d.toLocaleDateString("es", { month: "short" }),
      income: sum(rows.filter((e) => e.kind === "income")),
      expense: sum(rows.filter((e) => e.kind === "expense")),
    };
  });
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  return `<div class="chart">${months.map((m) => `<div class="chart-column"><div class="chart-bars"><progress max="${max}" value="${m.income}" aria-label="${m.name}: ingresos ${money(m.income)}" title="Ingresos ${money(m.income)}"></progress><progress class="expense" max="${max}" value="${m.expense}" aria-label="${m.name}: gastos ${money(m.expense)}" title="Gastos ${money(m.expense)}"></progress></div><small>${m.name}</small></div>`).join("")}</div>`;
}
function summary() {
  const month = today().slice(0, 7),
    rows = businessEntries().filter((e) => e.day.startsWith(month));
  const incoming = sum(rows.filter((e) => e.kind === "income")),
    outgoing = sum(rows.filter((e) => e.kind === "expense"));
  const pending = pendingRecords().filter((r) => r.kind !== "payable");
  const upcoming = data.records
    .filter(
      (r) =>
        ["service", "rental"].includes(r.kind) &&
        ["pending", "active"].includes(r.status),
    )
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 4);
  return (
    heading(
      "Todo bajo control.",
      "Una mirada clara al dinero y a lo que viene.",
      button("+ Registrar movimiento", "income", true),
    ) +
    `<div class="hero"><div><p class="eyebrow">HECHO PARA TU ELECTRÓNICA</p><h2>Más tiempo para crear.<br>Más claridad para crecer.</h2><p>Productos, fabricación y robótica en un mismo lugar. El dinero de tu negocio y el tuyo, cada uno en su cuenta.</p></div><div class="hero-art"><span>${icon("box")}</span><span>${icon("robot")}</span><span>${icon("tool")}</span></div></div>` +
    `<div class="metrics">${metric("Disponible en el negocio", money(balance("business")), "Saldo de todas tus cuentas", true)}${metric("Ingresos del mes", money(incoming), "Cobros registrados · USD", false, "down")}${metric("Gastos del mes", money(outgoing), "Salidas operativas · USD", false, "up")}${metric("Por cobrar", money(pending.reduce((s, r) => s + outstanding(r), 0)), pending.length + " operaciones pendientes", false, "clock")}</div>` +
    `<div class="dashboard-grid"><div><section class="panel"><div class="panel-head"><h2>El ritmo de tu negocio</h2><span class="tag gray">Últimos 6 meses</span></div><div class="legend"><span><i></i>Ingresos</span><span><i class="light"></i>Gastos</span></div>${chart()}<p class="footnote">Flujo de caja registrado. Transferencias y saldos iniciales excluidos.</p></section><section class="panel"><div class="panel-head"><h2>Últimos movimientos</h2><button class="btn small" data-view="entries">Ver todos ↗</button></div>${
      data.entries.length
        ? data.entries
            .slice(0, 5)
            .map(
              (e) =>
                `<div class="list-row"><div class="list-left"><span class="tile">${icon(e.kind === "income" ? "down" : e.kind === "expense" ? "up" : "arrows")}</span><div><b>${esc(e.description)}</b><small>${esc(account(e.account_id)?.name)} · ${esc(e.day)}${e.void_reason ? " · Anulado" : ""}</small></div></div><b class="${e.kind === "income" ? "positive" : ""}">${e.kind === "expense" ? "−" : ""}${money(e.amount)}</b></div>`,
            )
            .join("")
        : empty(
            "Tu historia empieza aquí",
            "Registra tu primer ingreso, gasto o transferencia.",
          )
    }</section></div><div><section class="panel"><div class="panel-head"><h2>¿Qué hacemos hoy?</h2></div><div class="quick-grid">${[
      ["sale", "box", "Vender"],
      ["expense", "up", "Un gasto"],
      ["service", "tool", "Un servicio"],
      ["rental", "robot", "Un alquiler"],
    ]
      .map(
        ([a, i, t]) =>
          `<button class="quick" data-action="${a}">${icon(i)}${t}</button>`,
      )
      .join(
        "",
      )}</div></section><section class="panel"><div class="panel-head"><h2>En tu agenda</h2>${pill(upcoming.length + " pendientes", "gray")}</div>${upcoming.length ? upcoming.map((r) => `<div class="list-row"><div class="list-left"><span class="tile">${icon(r.kind === "rental" ? "robot" : "tool")}</span><div><b>${esc(r.title)}</b><small>${esc(r.contact)} · ${r.due}</small></div></div>${pill(statusNames[r.status], r.due < today() ? "warn" : "")}</div>`).join("") : empty("Agenda despejada", "Tus trabajos y reservas aparecerán aquí.")}</section><section class="panel"><div class="panel-head"><h2>Tu dinero personal</h2>${icon("wallet")}</div><h1>${money(balance("personal"))}</h1><p class="subtitle">Separado del dinero de la electrónica.</p><button class="btn small" data-view="accounts">Ver mis cuentas ↗</button></section></div></div>`
  );
}
function recordTable(records) {
  if (!records.length)
    return empty(
      "Todavía no hay operaciones",
      "Añade una venta, trabajo, reserva o cuenta por pagar.",
    );
  return table(
    [
      "Concepto / cliente",
      "Entrega o vencimiento",
      "Total",
      "Cobrado / pagado",
      "Pendiente",
      "Estado",
      "Acciones",
    ],
    records.map(
      (r) =>
        `<tr><td><b>${esc(r.title)}</b><small>${esc(r.contact)}${r.phone ? " · " + esc(r.phone) : ""}</small>${r.starts ? `<small>${r.starts} → ${r.ends} · ${esc(data.assets.find((a) => a.id === r.asset_id)?.name)}</small>` : ""}${r.notes ? `<small>${esc(r.notes)}</small>` : ""}</td><td>${r.due}${r.due < today() && outstanding(r) > 0 && r.status !== "cancelled" ? '<small class="negative">Vencido</small>' : ""}</td><td>${money(r.total)}</td><td>${money(r.paid)}</td><td>${r.status === "cancelled" ? "—" : money(outstanding(r))}</td><td>${pill(statusNames[r.status], r.status === "cancelled" ? "gray" : r.status === "pending" ? "warn" : "")}</td><td><div class="actions">${r.status !== "cancelled" && outstanding(r) > 0 ? `<button class="btn small" data-pay="${r.id}">${r.kind === "payable" ? "Pagar" : "Cobrar"}</button>` : ""}<button class="btn small" data-detail="${r.id}">Ver</button></div></td></tr>`,
    ),
  );
}
function recordsPage(kind) {
  const map = {
    sale: [
      "Ventas",
      "Registra ventas presenciales con salida real de inventario.",
      "Nueva venta",
    ],
    service: [
      "Servicios",
      "Impresión 3D, corte láser y trabajos a medida.",
      "Nuevo servicio",
    ],
    rental: [
      "Alquileres",
      "Reservas y devoluciones de tus robots, sin cruces de fechas.",
      "Nueva reserva",
    ],
  };
  const [title, sub, label] = map[kind];
  return (
    heading(
      title,
      sub,
      button("+ " + label, kind, true) +
        (kind === "rental" ? button("+ Robot", "asset") : ""),
    ) +
    (kind === "rental"
      ? `<div class="scope-note">${data.assets.length ? data.assets.map((a) => "<b>" + esc(a.name) + "</b>" + (a.serial ? " · " + esc(a.serial) : "")).join(" &nbsp; / &nbsp; ") : "Registra cada unidad: Abito, Unitree Go2 u otro robot. Las fechas de entrega y devolución quedan bloqueadas mientras la reserva esté abierta."}</div>`
      : "") +
    `<section class="panel">${search()}<div id="filtered-records">${recordTable(filteredRecords(kind))}</div></section>` +
    `<p class="footnote">${kind === "sale" ? "El stock se descuenta al registrar la venta. Registra su cobro para afectar la caja. Las ventas de la tienda web se consultan en Administración; no se importan automáticamente a este libro." : "El precio acordado genera una cuenta por cobrar. Los abonos se registran aparte en la cuenta que recibió el dinero."}</p>`
  );
}
const search = () =>
  `<div class="filters"><input class="search" id="search" type="search" aria-label="Buscar" placeholder="Buscar por concepto, cliente o referencia…" value="${esc(filter)}"></div>`;
const filteredRecords = (kind) =>
  data.records.filter(
    (r) =>
      (!kind || r.kind === kind) &&
      `${r.title} ${r.contact} ${r.phone}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
  );
function filteredEntries() {
  return data.entries.filter(
    (e) =>
      (scope === "all" ||
        account(e.account_id)?.scope === scope ||
        account(e.to_account_id)?.scope === scope) &&
      (!from || e.day >= from) &&
      (!to || e.day <= to) &&
      `${e.description} ${e.category} ${account(e.account_id)?.name}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
  );
}
function entryTable() {
  const entries = filteredEntries();
  return entries.length
    ? table(
        ["Fecha", "Concepto", "Cuenta", "Tipo", "Importe", ""],
        entries.map(
          (e) =>
            `<tr><td>${e.day}</td><td><b>${esc(e.description)}</b><small>${esc(e.category)}${e.void_reason ? " · Anulado: " + esc(e.void_reason) : ""}</small></td><td>${esc(account(e.account_id)?.name)}${e.to_account_id ? "<small>→ " + esc(account(e.to_account_id)?.name) + "</small>" : ""}</td><td>${pill(kindNames[e.kind], e.void_reason ? "gray" : e.kind === "expense" ? "warn" : "")}</td><td>${money(e.amount)}</td><td>${!e.void_reason ? `<button class="btn small" data-void="${e.id}">Anular</button>` : ""}</td></tr>`,
        ),
      )
    : empty(
        "Sin movimientos en esta selección",
        "Los ingresos, gastos y transferencias aparecerán aquí.",
      );
}
function entriesPage() {
  return (
    heading(
      "Cada movimiento cuenta.",
      "Un libro de caja para el negocio y para ti.",
      button("+ Ingreso", "income", true) +
        button("− Gasto", "expense") +
        button("↔ Transferir", "transfer"),
    ) +
    `<section class="panel">${search()}<div class="filters"><label>Ámbito<select id="scope"><option value="all">Todos</option><option value="business" ${scope === "business" ? "selected" : ""}>Negocio</option><option value="personal" ${scope === "personal" ? "selected" : ""}>Personal</option></select></label><label>Desde<input id="from" type="date" value="${from}"></label><label>Hasta<input id="to" type="date" value="${to}"></label><button class="btn" data-action="csv">Exportar CSV</button></div><div id="entry-table">${entryTable()}</div></section><p class="footnote">Anular corrige un registro, no ejecuta una devolución bancaria. El movimiento y su motivo permanecen en el historial.</p>`
  );
}
function accountsPage() {
  return (
    heading(
      "Un lugar para cada dólar.",
      "Caja, bancos y dinero personal, con saldos independientes.",
      button("+ Nueva cuenta", "account", true),
    ) +
    `<div class="scope-note">Para retirar dinero para ti o aportar al negocio, usa <b>Transferir</b> entre una cuenta del negocio y una personal. Así no se confunde con ventas ni gastos operativos.</div><div class="account-grid">${data.accounts.length ? data.accounts.map((a) => `<article class="account-card">${pill(a.scope === "business" ? "NEGOCIO" : "PERSONAL", a.scope === "personal" ? "warn" : "")}<h2 class="subtitle">${esc(a.name)}</h2><strong>${money(a.balance)}</strong><small>Saldo inicial: ${money(a.opening)}</small></article>`).join("") : empty("Crea tus primeras cuentas", "Por ejemplo: Caja del local, Banco del negocio y Mi cuenta personal.")}</div><div class="actions footnote">${button("Transferir entre cuentas", "transfer")}${button("Registrar ingreso", "income")}${button("Registrar gasto", "expense")}</div>`
  );
}
function pendingPage() {
  const rows = pendingRecords().filter((r) =>
    `${r.title} ${r.contact}`.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    heading(
      "Lo pendiente, a la vista.",
      "Controla abonos de clientes y obligaciones con proveedores.",
      button("+ Cuenta por pagar", "payable", true),
    ) +
    `<div class="metrics">${metric("Por cobrar", money(rows.filter((r) => r.kind !== "payable").reduce((s, r) => s + outstanding(r), 0)), "Clientes y servicios")}${metric("Por pagar", money(rows.filter((r) => r.kind === "payable").reduce((s, r) => s + outstanding(r), 0)), "Proveedores y obligaciones")}</div><section class="panel">${search()}<div id="filtered-records">${recordTable(rows)}</div></section>`
  );
}
function inventoryPage() {
  const rows = data.products
    .flatMap((p) => {
      const vs = data.variants.filter((v) => v.product_id === p.id);
      return vs.length
        ? vs.map((v) => ({ ...p, ...v, name: p.name + " · " + v.name }))
        : p;
    })
    .filter((p) =>
      `${p.name} ${p.sku}`.toLowerCase().includes(filter.toLowerCase()),
    );
  return (
    heading(
      "Tu inventario conectado.",
      "Existencias compartidas con la tienda y las ventas presenciales.",
      `<a class="btn primary" href="/admin">Administrar productos ↗</a>`,
    ) +
    `<section class="panel">${search()}${
      rows.length
        ? table(
            ["Producto", "SKU", "Precio", "Stock", "Estado"],
            rows.map(
              (p) =>
                `<tr><td>${esc(p.name)}${p.demo ? "<small>Demostración · no disponible para venta real</small>" : ""}</td><td>${esc(p.sku)}</td><td>${money(p.price)}</td><td>${p.stock}</td><td>${pill(p.stock <= p.min_stock ? "Reponer" : "Disponible", p.stock <= p.min_stock ? "warn" : "")}</td></tr>`,
            ),
          )
        : empty(
            "Sin productos",
            "Añade tus impresoras, filamentos, Arduinos y robots en Administración.",
          )
    }</section>`
  );
}
function reportsPage() {
  const rows = businessEntries().filter(
    (e) => (!from || e.day >= from) && (!to || e.day <= to),
  );
  const income = sum(rows.filter((e) => e.kind === "income")),
    expense = sum(rows.filter((e) => e.kind === "expense"));
  const cats = {};
  for (const e of rows.filter((e) => e.kind === "expense"))
    cats[e.category] = (cats[e.category] || 0) + e.amount;
  return (
    heading(
      "Los números, claros.",
      "Flujo de caja del negocio según los movimientos registrados.",
      button("Exportar movimientos", "csv"),
    ) +
    `<div class="filters"><label>Desde<input id="from" type="date" value="${from}"></label><label>Hasta<input id="to" type="date" value="${to}"></label></div><div class="metrics">${metric("Ingresos cobrados", money(income), "Dentro del período")}${metric("Gastos pagados", money(expense), "Dentro del período")}${metric("Flujo neto operativo", money(income - expense), "Ingresos menos gastos", true)}${metric("Saldo personal actual", money(balance("personal")), "Fuera del resultado del negocio")}</div><div class="dashboard-grid"><section class="panel"><div class="panel-head"><h2>Gastos por categoría</h2></div>${
      Object.entries(cats).length
        ? Object.entries(cats)
            .sort((a, b) => b[1] - a[1])
            .map(
              ([name, total]) =>
                `<div class="list-row"><span>${esc(name)}</span><b>${money(total)}</b></div>`,
            )
            .join("")
        : empty(
            "Sin gastos registrados",
            "Aquí verás en qué se va el dinero del negocio.",
          )
    }</section><section class="panel"><h2>Cómo leer estos números</h2><p class="subtitle">El flujo neto muestra entradas y salidas operativas de efectivo; no representa la utilidad contable. Las transferencias entre cuentas, retiros personales y saldos iniciales se excluyen.</p><p class="subtitle">El costo estimado de un trabajo sirve para cotizar. Para reflejar sus materiales o mano de obra en caja, registra el gasto cuando lo pagues.</p><p class="subtitle">Los anticipos de clientes cuentan como entradas de caja. Las garantías reembolsables, impuestos, depreciaciones y emisión fiscal requieren tratamiento contable adicional.</p></section></div>`
  );
}
function render() {
  const content = {
    summary,
    entries: entriesPage,
    accounts: accountsPage,
    sales: () => recordsPage("sale"),
    services: () => recordsPage("service"),
    rentals: () => recordsPage("rental"),
    pending: pendingPage,
    inventory: inventoryPage,
    reports: reportsPage,
  }[view]();
  $("#app").innerHTML =
    `<div class="shell"><aside class="side"><a class="brand owner-brand" href="/gestion.html">${logo}<small>MI NEGOCIO</small></a><div><p class="side-label">ESPACIO DE TRABAJO</p><nav class="nav" aria-label="Gestión">${Object.entries(
      names,
    )
      .map(
        ([key, name], i) =>
          `<button data-view="${key}" class="${view === key ? "active" : ""}" ${view === key ? 'aria-current="page"' : ""}>${icon(["home", "arrows", "wallet", "box", "tool", "robot", "clock", "box", "chart"][i])}${name}</button>`,
      )
      .join(
        "",
      )}</nav></div><div class="side-bottom"><a class="side-link" href="/admin">↗ Administrar la tienda</a><a class="side-link" href="/">↗ Ir a mi web</a><p>Un espacio privado.<br>Para hacer crecer lo tuyo.</p></div></aside><div class="main"><header class="topbar"><div class="breadcrumb">${esc(business)} &nbsp; / &nbsp; <b>${names[view]}</b></div><div class="user"><span class="tag gray">USD</span><span class="avatar">${esc(user.name.slice(0, 1).toUpperCase())}</span><span class="user-name">${esc(user.name)}<br><small>Propietario</small></span><button data-action="logout">Salir</button></div></header><main class="content" id="content">${previewNotice()}${content}</main></div></div>`;
}
async function refresh() {
  data = await api("/management");
  render();
}
function showModal(title, fields, submit, label = "Guardar") {
  const dialog = $("#modal");
  dialog.innerHTML = `<form id="editor"><div class="modal-head"><h2>${title}</h2><button type="button" data-close aria-label="Cerrar">×</button></div><div class="form-grid">${fields}</div><p class="form-error" role="alert"></p><div class="form-actions"><button type="button" class="btn" data-close>Cancelar</button><button class="btn primary" type="submit">${label}</button></div></form>`;
  dialog.showModal();
  $("#editor").onsubmit = async (event) => {
    event.preventDefault();
    const btn = event.submitter;
    btn.disabled = true;
    const b = Object.fromEntries(new FormData(event.target));
    try {
      await submit(b);
      dialog.close();
      await refresh();
      notice("Guardado correctamente.");
    } catch (e) {
      $("#editor .form-error").textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  };
}
const field = (label, name, type = "text", value = "", extra = "") =>
  `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra} required></label>`;
const select = (label, name, options, extra = "") =>
  `<label ${extra}>${label}<select name="${name}" required>${options}</select></label>`;
const option = (v, t) => `<option value="${esc(v)}">${esc(t)}</option>`;
const amount = (label, name, value = "") =>
  field(label, name, "number", value, 'step="0.01" min="0.01" max="1000000"');
function entryForm(kind, record) {
  if (!data.accounts.length) {
    notice("Primero crea una cuenta para registrar tu dinero.");
    view = "accounts";
    render();
    return;
  }
  const accounts = data.accounts.filter(
    (a) => !record || a.scope === "business",
  );
  if (!accounts.length) {
    notice("Necesitas una cuenta del negocio para cobrar o pagar.");
    return;
  }
  const request_key = crypto.randomUUID();
  showModal(
    record
      ? kind === "income"
        ? "Registrar abono"
        : "Registrar pago"
      : kindNames[kind],
    `<p class="help full">${kind === "transfer" ? "Mueve dinero entre tus cuentas. Los retiros personales y aportes no se suman a las ventas ni a los gastos." : record ? "Saldo pendiente: " + money(outstanding(record)) : "Si corresponde a una venta o trabajo registrado, usa su botón Cobrar o Pagar para reducir el saldo pendiente."}</p>` +
      select(
        kind === "transfer" ? "Desde la cuenta" : "Cuenta",
        "account_id",
        accounts
          .map((a) =>
            option(
              a.id,
              a.name +
                " · " +
                (a.scope === "business" ? "Negocio" : "Personal"),
            ),
          )
          .join(""),
      ) +
      (kind === "transfer"
        ? select(
            "Hacia la cuenta",
            "to_account_id",
            data.accounts.map((a) => option(a.id, a.name)).join(""),
          )
        : "") +
      amount(
        "Importe · USD",
        "amount",
        record ? (outstanding(record) / 100).toFixed(2) : "",
      ) +
      field("Fecha", "day", "date", today()) +
      field(
        "Concepto",
        "description",
        "text",
        record?.title || "",
        'maxlength="250"',
      ) +
      select(
        "Categoría",
        "category",
        (kind === "transfer"
          ? ["Retiro personal", "Aporte al negocio", "Entre cuentas"]
          : kind === "income"
            ? [
                "Ventas",
                "Impresión 3D",
                "Corte láser",
                "Alquiler de robots",
                "Otros ingresos",
              ]
            : [
                "Mercadería",
                "Materiales",
                "Alquiler del local",
                "Servicios básicos",
                "Transporte",
                "Personal",
                "Gastos personales",
                "Otros gastos",
              ]
        )
          .map((c) => option(c, c))
          .join(""),
      ),
    (b) =>
      api("/management/entries", {
        ...b,
        kind,
        amount: cents(b.amount),
        request_key,
        record_id: record?.id,
      }),
  );
}
function recordForm(kind) {
  const request_key = crypto.randomUUID();
  if (kind === "rental" && !data.assets.length) {
    notice("Registra primero el robot que vas a alquilar.");
    assetForm();
    return;
  }
  const products = data.products
    .filter((p) => !p.demo)
    .flatMap((p) => {
      const variants = data.variants.filter((v) => v.product_id === p.id);
      return variants.length
        ? variants.map((v) => ({
            ...v,
            product_id: p.id,
            variant_id: v.id,
            name: p.name + " · " + v.name,
          }))
        : [{ ...p, product_id: p.id }];
    });
  if (kind === "sale" && !products.length) {
    notice(
      "Añade productos reales en Administración antes de registrar ventas.",
    );
    view = "inventory";
    render();
    return;
  }
  const line = () =>
    `<div class="sale-line"><select aria-label="Producto" class="line-product">${products.map((p, i) => option(i, p.name + " · " + money(p.price) + " · Stock " + p.stock)).join("")}</select><input aria-label="Cantidad" class="line-qty" type="number" min="1" max="10000" value="1" required><button type="button" data-remove-line aria-label="Quitar producto">×</button></div>`;
  showModal(
    kind === "payable"
      ? "Nueva cuenta por pagar"
      : "Nuevo registro · " + kindNames[kind],
    field(
      "Concepto",
      "title",
      "text",
      kind === "sale" ? "Venta presencial" : "",
      'maxlength="200"',
    ) +
      field(
        kind === "payable" ? "Proveedor" : "Cliente",
        "contact",
        "text",
        "",
        'maxlength="150"',
      ) +
      `<label>Teléfono (opcional)<input name="phone" maxlength="50"></label>` +
      field(
        kind === "rental" ? "Fecha de cobro prevista" : "Entrega / vencimiento",
        "due",
        "date",
        today(),
      ) +
      (kind === "sale"
        ? `<div class="full"><div id="sale-lines">${line()}</div><button class="btn small" type="button" id="add-line">+ Añadir producto</button><p class="help">Precio del catálogo. El stock sale al guardar; cobra después desde la venta.</p><p class="record-total" id="sale-total"></p></div>`
        : amount("Precio total acordado · USD", "total") +
          field(
            "Costo estimado · USD",
            "cost",
            "number",
            "0",
            'step="0.01" min="0" max="1000000"',
          )) +
      (kind === "rental"
        ? select(
            "Robot / unidad",
            "asset_id",
            data.assets
              .map((a) => option(a.id, a.name + " " + a.serial))
              .join(""),
          ) +
          field("Entrega del robot", "starts", "date", today()) +
          field("Devolución del robot", "ends", "date", today())
        : "") +
      `<label class="full">Notas y especificaciones<textarea name="notes" maxlength="2000" placeholder="Material, medidas, color, horas de trabajo, condiciones de entrega…"></textarea></label>`,
    (b) => {
      const lines =
        kind === "sale"
          ? [...document.querySelectorAll(".sale-line")].map((row) => {
              const p = products[Number(row.querySelector("select").value)];
              return {
                product_id: p.product_id,
                variant_id: p.variant_id,
                quantity: Number(row.querySelector("input").value),
              };
            })
          : undefined;
      return api("/management/records", {
        ...b,
        kind,
        request_key,
        total: kind === "sale" ? 1 : cents(b.total),
        cost: cents(b.cost || "0"),
        lines,
      });
    },
  );
  if (kind === "sale") {
    const update = () => {
      $("#sale-total").textContent =
        "Total: " +
        money(
          [...document.querySelectorAll(".sale-line")].reduce(
            (s, row) =>
              s +
              products[Number(row.querySelector("select").value)].price *
                Number(row.querySelector("input").value),
            0,
          ),
        );
    };
    $("#add-line").onclick = () => {
      $("#sale-lines").insertAdjacentHTML("beforeend", line());
      update();
    };
    $("#sale-lines").oninput = update;
    $("#sale-lines").onclick = (e) => {
      if (e.target.closest("[data-remove-line]")) {
        e.target.closest(".sale-line").remove();
        update();
      }
    };
    update();
  }
}
function assetForm() {
  showModal(
    "Registrar un robot",
    field(
      "Nombre / modelo",
      "name",
      "text",
      "",
      'placeholder="Abito o Unitree Go2" maxlength="120"',
    ) +
      `<label>Serie o identificador (opcional)<input name="serial" placeholder="Unidad 01" maxlength="120"></label>`,
    (b) => api("/management/assets", b),
  );
}
function details(r) {
  const dialog = $("#modal");
  dialog.innerHTML = `<div class="modal-head"><h2>${esc(r.title)}</h2><button data-close aria-label="Cerrar">×</button></div><p class="subtitle">${kindNames[r.kind]} · ${esc(r.contact)} · ${statusNames[r.status]}</p><div class="list-row"><span>Total acordado</span><b>${money(r.total)}</b></div><div class="list-row"><span>Costo estimado (no afecta caja)</span><b>${money(r.cost)}</b></div><div class="list-row"><span>Saldo pendiente</span><b>${money(outstanding(r))}</b></div><p class="subtitle">${esc(r.notes) || "Sin notas adicionales."}</p><h3 class="subtitle">Cobros y pagos vinculados</h3>${
    data.entries
      .filter((e) => e.record_id === r.id)
      .map(
        (e) =>
          `<div class="list-row"><span>${e.day} · ${esc(account(e.account_id)?.name)}${e.void_reason ? " · Anulado" : ""}</span><b>${money(e.amount)}</b></div>`,
      )
      .join("") || '<p class="help">Todavía sin abonos.</p>'
  }<p class="help">Completar un trabajo o marcar un robot devuelto no liquida su deuda. Cancelar una venta restituye el inventario una sola vez.</p><div class="actions subtitle">${["pending", "active"].includes(r.status) ? `${r.status === "pending" ? `<button class="btn" data-status="active" data-id="${r.id}">Iniciar</button>` : ""}<button class="btn primary" data-status="done" data-id="${r.id}">${r.kind === "rental" ? "Marcar devuelto" : "Completar"}</button><button class="btn danger" data-status="cancelled" data-id="${r.id}">Cancelar operación</button>` : ""}</div><p class="form-error" role="alert"></p>`;
  dialog.showModal();
}
function exportCsv() {
  const rows =
    view === "reports"
      ? data.entries.filter(
          (e) =>
            account(e.account_id)?.scope === "business" &&
            (!from || e.day >= from) &&
            (!to || e.day <= to),
        )
      : filteredEntries();
  const safe = (v) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const text = [
    [
      "Fecha",
      "Tipo",
      "Cuenta",
      "Ámbito",
      "Destino",
      "Categoría",
      "Concepto",
      "Importe USD",
      "Operación",
      "Motivo de anulación",
    ],
    ...rows.map((e) => [
      e.day,
      kindNames[e.kind],
      account(e.account_id)?.name,
      account(e.account_id)?.scope,
      account(e.to_account_id)?.name,
      e.category,
      e.description,
      (e.amount / 100).toFixed(2),
      e.record_id,
      e.void_reason,
    ]),
  ]
    .map((r) => r.map(safe).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "virtus-movimientos-" + today() + ".csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function action(name) {
  if (name === "setup") return setupForm();
  if (["income", "expense", "transfer"].includes(name)) return entryForm(name);
  if (["sale", "service", "rental", "payable"].includes(name))
    return recordForm(name);
  if (name === "asset") return assetForm();
  if (name === "account")
    return showModal(
      "Nueva cuenta",
      field(
        "Nombre",
        "name",
        "text",
        "",
        'placeholder="Caja del local" maxlength="100"',
      ) +
        select(
          "Pertenece a",
          "scope",
          option("business", "Mi negocio") +
            option("personal", "Mi dinero personal"),
        ) +
        field(
          "Saldo al empezar · USD",
          "opening",
          "number",
          "0",
          'step="0.01" min="-1000000" max="1000000"',
        ) +
        '<p class="help">Introduce el saldo real antes de registrar movimientos. Puede ser negativo si existe un sobregiro.</p>',
      (b) => api("/management/accounts", { ...b, opening: cents(b.opening) }),
    );
  if (name === "csv") return exportCsv();
  if (name === "logout") {
    await api("/auth/logout", {});
    data = null;
    user = null;
    login();
  }
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  try {
    if (b.hasAttribute("data-close")) return $("#modal").close();
    if (b.dataset.view) {
      view = b.dataset.view;
      filter = "";
      render();
      return;
    }
    if (b.dataset.action) return await action(b.dataset.action);
    if (b.dataset.pay) {
      const r = data.records.find((r) => r.id === b.dataset.pay);
      return entryForm(r.kind === "payable" ? "expense" : "income", r);
    }
    if (b.dataset.detail)
      return details(data.records.find((r) => r.id === b.dataset.detail));
    if (b.dataset.void)
      return showModal(
        "Anular movimiento",
        '<p class="help full">Esta corrección elimina el efecto en los saldos y conserva el historial. No devuelve dinero automáticamente.</p>' +
          field("Motivo de anulación", "reason", "text", "", 'maxlength="250"'),
        (v) => api("/management/entries/" + b.dataset.void + "/void", v),
        "Confirmar anulación",
      );
    if (b.dataset.status) {
      b.disabled = true;
      try {
        await api(
          "/management/records/" + b.dataset.id,
          { status: b.dataset.status },
          "PATCH",
        );
        $("#modal").close();
        await refresh();
        notice("Estado actualizado.");
      } catch (error) {
        $("#modal .form-error").textContent = error.message;
        b.disabled = false;
      }
    }
  } catch (error) {
    notice(error.message);
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id !== "search") return;
  filter = e.target.value;
  if (view === "entries") $("#entry-table").innerHTML = entryTable();
  else if (["sales", "services", "rentals"].includes(view))
    $("#filtered-records").innerHTML = recordTable(
      filteredRecords(
        { sales: "sale", services: "service", rentals: "rental" }[view],
      ),
    );
  else {
    const pos = e.target.selectionStart;
    render();
    $("#search").focus();
    $("#search").setSelectionRange(pos, pos);
  }
});
document.addEventListener("change", (e) => {
  if (["scope", "from", "to"].includes(e.target.id)) {
    if (e.target.id === "scope") scope = e.target.value;
    if (e.target.id === "from") from = e.target.value;
    if (e.target.id === "to") to = e.target.value;
    render();
  }
});
function login(message = "") {
  $("#app").innerHTML =
    `<main class="login" id="content">${logo}<p class="eyebrow">VIRTUS · MI NEGOCIO</p><h1>Tu negocio.<br>Tu tranquilidad.</h1><p class="subtitle">Entra a tu espacio privado de gestión.</p><form id="login"><label>Correo<input type="email" name="email" autocomplete="username" required></label><label>Contraseña<input type="password" name="password" autocomplete="current-password" required></label><p class="form-error" role="alert">${esc(message)}</p><button class="btn primary" type="submit">Entrar a mi negocio →</button></form>${setupAvailable ? '<p class="help">Primera instalación: crea tu único usuario privado.</p><button class="btn" data-action="setup">Crear mi usuario propietario</button>' : '<p class="help">Acceso exclusivo del propietario.</p>'}<a class="side-link" href="/">← Volver a mi web</a></main>`;
  $("#login").onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.submitter;
    btn.disabled = true;
    try {
      const u = await api(
        "/auth/login",
        Object.fromEntries(new FormData(e.target)),
      );
      if (u.role !== "super_admin")
        throw new Error("Esta cuenta no tiene acceso de propietario.");
      user = u;
      await refresh();
    } catch (error) {
      $("#login .form-error").textContent = error.message;
    } finally {
      btn.disabled = false;
    }
  };
}
let setupAvailable = false;
function setupForm() {
  $("#app").innerHTML =
    `<main class="login" id="content">${logo}<h1>Crea tu acceso privado.</h1><p class="subtitle">Solo se puede crear un propietario. Guarda tu contraseña en un lugar seguro.</p><form id="setup"><label>Tu nombre<input name="name" autocomplete="name" maxlength="150" required></label><label>Tu correo<input name="email" type="email" autocomplete="username" required></label><label>Contraseña (mínimo 12 caracteres)<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><label>Repite la contraseña<input name="confirm" type="password" autocomplete="new-password" required></label><label>Clave de instalación<input name="setup_key" type="password" autocomplete="off" required></label><p class="help">En Render: abre tu servicio → Environment → OWNER_SETUP_KEY. Usa su valor aquí. No es tu contraseña de acceso.</p><p class="form-error" role="alert"></p><button class="btn primary" type="submit">Crear mi usuario</button></form><button class="btn" id="back-login">Volver al inicio de sesión</button></main>`;
  $("#back-login").onclick = () => login();
  $("#setup").onsubmit = async (e) => {
    e.preventDefault();
    const button = e.submitter;
    button.disabled = true;
    try {
      const b = Object.fromEntries(new FormData(e.target));
      if (b.password !== b.confirm)
        throw new Error("Las contraseñas no coinciden.");
      delete b.confirm;
      await api("/auth/owner-setup", b);
      setupAvailable = false;
      login("Tu usuario está creado. Ahora inicia sesión.");
    } catch (error) {
      $("#setup .form-error").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
}
try {
  const boot = await api("/bootstrap");
  const setup = await api("/auth/owner-setup");
  setupAvailable = setup.available && setup.enabled;
  preview = boot.preview === true;
  business = boot.settings.businessName || business;
  user = boot.user;
  if (user?.role === "super_admin") await refresh();
  else
    login(user ? "Tu cuenta necesita el rol de propietario para entrar." : "");
} catch (error) {
  login(error.message);
}
