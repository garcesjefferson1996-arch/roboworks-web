import {
  $,
  $$,
  esc,
  money,
  date,
  api,
  icon,
  toast,
  modal,
  closeModal,
  field,
  textarea,
  select,
  formData,
  onForm,
  empty,
  errorBox,
  filePayload,
  downloadInvoice,
} from "./ui.js";
let state,
  helpers,
  current = "summary",
  cache = {};
const allowed = (p) =>
  state.user.permissions.includes("*") || state.user.permissions.includes(p);
const tabs = [
  ["summary", "Resumen", "chart", null],
  ["products", "Productos", "box", "products"],
  ["categories", "Categorías", "grid", "products"],
  ["inventory", "Inventario", "sliders", "inventory"],
  ["orders", "Pedidos", "bag", "orders"],
  ["customers", "Clientes", "user", "customers"],
  ["coupons", "Promociones", "bolt", "promotions"],
  ["articles", "Virtus Lab", "book", "content"],
  ["settings", "Contenido y ajustes", "edit", "settings"],
  ["inquiries", "Solicitudes", "chat", "inquiries"],
  ["roles", "Roles y permisos", "shield", "*"],
];
const heading = (title, copy, action = "") =>
  `<div class="admin-heading"><div><span class="eyebrow">VIRTUS · ADMINISTRACIÓN</span><h1>${title}</h1><p>${copy}</p></div>${action}</div>`;
const actionButton = (text, id) =>
  `<button class="button small" id="${id}">${icon("plus")}${text}</button>`;
const table = (headers, rows) =>
  `<div class="table-scroll"><table class="admin-table"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.join("") : `<tr><td colspan="${headers.length}"><p class="muted">Todavía no hay registros.</p></td></tr>`}</tbody></table></div>`;
const edit = (id, type) =>
  `<button class="icon-button" data-edit-${type}="${id}" aria-label="Editar">${icon("edit")}</button>`;
const del = (id, type) =>
  `<button class="icon-button" data-delete-${type}="${id}" aria-label="Eliminar">${icon("trash")}</button>`;
const checkbox = (text, name, checked) =>
  `<label class="checkbox"><input type="checkbox" name="${name}" ${checked ? "checked" : ""}>${text}</label>`;
export async function renderAdmin(s, h) {
  state = s;
  helpers = h;
  if (!state.user.permissions.some((p) => p !== "account"))
    return `<div class="wrap section">${empty("Este espacio es para el equipo.", "Tu cuenta de cliente no tiene permisos de administración.", "/cuenta", "Volver a mi cuenta")}</div>`;
  if (
    !tabs.some(
      ([key, , , perm]) =>
        key === current &&
        (!perm ||
          allowed(perm) ||
          (key === "orders" && allowed("orders:read"))),
    )
  )
    current = "summary";
  return `<div class="admin-shell"><aside class="admin-sidebar"><span class="eyebrow">TU CENTRO DE CONTROL</span>${state.user.role === 'super_admin' ? '<a class="button small" href="/gestion.html">Mi negocio · Finanzas ↗</a>' : ''}${tabs
    .filter(
      ([, , , p]) =>
        !p || allowed(p) || (p === "orders" && allowed("orders:read")),
    )
    .map(
      ([key, label, i]) =>
        `<button data-admin-tab="${key}" class="${key === current ? "active" : ""}">${icon(i)}${label}</button>`,
    )
    .join(
      "",
    )}</aside><div class="admin-content" id="admin-content">${await page()}</div></div>`;
}
async function switchTab(tab) {
  current = tab;
  $$("[data-admin-tab]").forEach((b) =>
    b.classList.toggle("active", b.dataset.adminTab === tab),
  );
  $("#admin-content").innerHTML =
    '<div class="loading"><span class="spinner"></span></div>';
  try {
    $("#admin-content").innerHTML = await page();
    bindAdmin();
  } catch (e) {
    $("#admin-content").innerHTML =
      `<p class="form-error">${esc(e.message)}</p>`;
  }
}
async function page() {
  if (current === "summary") {
    const d = await api("/admin/summary");
    return (
      heading(
        "Una visión clara.",
        "La actividad real de tu tienda, en un solo lugar.",
      ) +
      `${state.settings.demo ? '<p class="admin-notice">Modo demostración. Las ventas de prueba no se incluyen en ingresos ni gráficos.</p>' : ""}<div class="metric-grid">${[
        ["Ingresos confirmados", money(d.metrics.revenue)],
        ["Pedidos reales", d.metrics.orders],
        ["Ticket promedio", money(d.metrics.average)],
        ["Clientes registrados", d.customers],
      ]
        .map(
          ([name, value]) =>
            `<div class="metric-card"><span>${name}</span><strong>${value}</strong></div>`,
        )
        .join(
          "",
        )}</div><div class="admin-grid"><section class="admin-panel"><h2>Ventas · últimos 30 días</h2>${d.daily.length ? `<div class="admin-chart">${d.daily.map((x) => `<div class="chart-bar"><b>${money(x.total)}</b><progress max="${Math.max(...d.daily.map((y) => y.total))}" value="${x.total}" aria-label="Ventas ${x.day}"></progress><span>${x.day.slice(5)}</span></div>`).join("")}</div>` : '<p class="muted">Las ventas confirmadas aparecerán aquí. No hay datos ficticios.</p>'}</section><section class="admin-panel"><h2>Más vendidos</h2>${d.bestsellers.length ? d.bestsellers.map((p) => `<div class="total-line"><span>${esc(p.name)}</span><b>${p.quantity}</b></div>`).join("") : '<p class="muted">Aún no hay ventas confirmadas.</p>'}</section></div><section class="admin-panel"><h2>Atención al inventario</h2>${table(
        ["Producto", "SKU", "Stock", "Mínimo"],
        d.lowStock.map(
          (p) =>
            `<tr><td>${esc(p.name)}</td><td>${esc(p.sku)}</td><td>${p.stock}</td><td>${p.min_stock}</td></tr>`,
        ),
      )}</section>`
    );
  }
  if (current === "products") {
    cache.products = await api("/admin/products");
    return (
      heading(
        "Cada pieza cuenta.",
        "Crea, organiza y actualiza tu catálogo.",
        actionButton("Crear producto", "new-product"),
      ) +
      `<input class="admin-search" id="admin-search" type="search" placeholder="Buscar producto o SKU" aria-label="Buscar producto"><div class="admin-panel">${table(
        ["Producto", "Precio", "Stock", "Estado", "Acciones"],
        cache.products.map(
          (p) =>
            `<tr data-search-row="${esc((p.name + " " + p.sku).toLowerCase())}"><td><div class="table-product"><img src="${esc(p.images[0]?.url || "/assets/favicon.svg")}" alt=""><div><strong>${esc(p.name)}</strong><small>${esc(p.sku)} · ${esc(p.category || "Sin categoría")}</small></div></div></td><td>${money(p.price)}</td><td>${p.variants.length ? p.variants.reduce((s, v) => s + v.stock, 0) : p.stock}</td><td><span class="badge">${p.active ? "Publicado" : "Borrador"}</span>${p.demo ? "<small> · Demo</small>" : ""}</td><td><div class="table-actions">${edit(p.id, "product")}<button class="icon-button" data-duplicate="${p.id}" aria-label="Duplicar">${icon("box")}</button>${del(p.id, "product")}</div></td></tr>`,
        ),
      )}</div>`
    );
  }
  if (current === "categories") {
    cache.categories = await api("/admin/categories");
    return (
      heading(
        "Todo en su lugar.",
        "Categorías y subcategorías del catálogo.",
        actionButton("Crear categoría", "new-category"),
      ) +
      `<div class="admin-panel">${table(
        ["Nombre", "URL", "Categoría padre", "Orden", "Estado", ""],
        cache.categories.map(
          (c) =>
            `<tr><td><strong>${esc(c.name)}</strong><small>${esc(c.description)}</small></td><td>${esc(c.slug)}</td><td>${esc(cache.categories.find((p) => p.id === c.parent_id)?.name || "—")}</td><td>${c.position}</td><td>${c.active ? "Activa" : "Inactiva"}</td><td><div class="table-actions">${edit(c.id, "category")}${del(c.id, "category")}</div></td></tr>`,
        ),
      )}</div>`
    );
  }
  if (current === "inventory") {
    cache.inventory = await api("/admin/inventory");
    return (
      heading(
        "Siempre al día.",
        "Registra entradas y salidas con un historial trazable.",
        actionButton("Registrar movimiento", "new-movement"),
      ) +
      `<section class="admin-panel"><h2>Existencias</h2>${table(
        ["Producto", "SKU", "Stock", "Mínimo"],
        cache.inventory.products.flatMap((p) =>
          [
            p,
            ...p.variants.map((v) => ({
              ...v,
              name: p.name + " · " + v.name,
              min_stock: p.min_stock,
            })),
          ].map(
            (v) =>
              `<tr><td>${esc(v.name)}</td><td>${esc(v.sku)}</td><td><span class="badge">${v.stock}${v.stock <= v.min_stock ? " · Bajo stock" : ""}</span></td><td>${v.min_stock}</td></tr>`,
          ),
        ),
      )}</section><section class="admin-panel"><h2>Últimos movimientos</h2>${table(
        ["Fecha", "Producto", "Cantidad", "Motivo"],
        cache.inventory.movements.map(
          (m) =>
            `<tr><td>${date(m.created_at)}</td><td>${esc(m.name)}</td><td>${m.quantity > 0 ? "+" : ""}${m.quantity}</td><td>${esc(m.reason)}</td></tr>`,
        ),
      )}</section>`
    );
  }
  if (current === "orders") {
    cache.orders = await api("/admin/orders");
    return (
      heading(
        "De la idea a la entrega.",
        "Gestiona pedidos, pagos y preparación.",
      ) +
      `<div class="admin-panel">${table(
        ["Pedido", "Cliente", "Fecha", "Total", "Estado", ""],
        cache.orders.map(
          (o) =>
            `<tr><td><strong>${esc(o.number)}</strong><small>${o.demo ? "Demostración" : "Pedido real"}</small></td><td><strong>${esc(o.customer.name)}</strong><small>${esc(o.email)}</small></td><td>${date(o.created_at)}</td><td>${money(o.total)}</td><td><span class="badge">${esc(o.status)}</span></td><td><button class="icon-button" data-view-order="${o.id}" aria-label="Ver pedido">${icon("eye")}</button></td></tr>`,
        ),
      )}</div>`
    );
  }
  if (current === "customers") {
    cache.customers = await api("/admin/customers");
    if (allowed("*")) cache.roles = await api("/admin/roles");
    return (
      heading(
        "Personas que crean.",
        "Clientes, contacto e historial de compras.",
      ) +
      `<div class="admin-panel">${table(
        ["Cliente", "Contacto", "Pedidos", "Total confirmado", "Rol", ""],
        cache.customers.map(
          (c) =>
            `<tr><td><strong>${esc(c.name)}</strong><small>Desde ${date(c.created_at)}</small></td><td><strong>${esc(c.email)}</strong><small>${esc(c.phone || "Sin teléfono")}</small></td><td>${c.orders}</td><td>${money(c.spent)}</td><td>${esc(c.role)}</td><td><button class="icon-button" data-view-customer="${c.id}" aria-label="Ver cliente">${icon("eye")}</button></td></tr>`,
        ),
      )}</div>`
    );
  }
  if (current === "coupons") {
    cache.coupons = await api("/admin/coupons");
    return (
      heading(
        "Una razón más para crear.",
        "Cupones con mínimos, límites y períodos de vigencia.",
        actionButton("Crear cupón", "new-coupon"),
      ) +
      `<div class="admin-panel">${table(
        ["Código", "Descuento", "Mínimo", "Usos", "Vigencia", "Estado", ""],
        cache.coupons.map(
          (c) =>
            `<tr><td><strong>${esc(c.code)}</strong></td><td>${c.kind === "percent" ? c.value + "%" : money(c.value)}</td><td>${money(c.min_total)}</td><td>${c.uses} / ${c.max_uses}</td><td>${esc(c.starts_at || "Sin inicio")} — ${esc(c.ends_at || "Sin fin")}</td><td>${c.active ? "Activo" : "Inactivo"}</td><td>${edit(c.id, "coupon")}</td></tr>`,
        ),
      )}</div>`
    );
  }
  if (current === "articles") {
    cache.articles = await api("/admin/articles");
    cache.catalog = (await api("/products?limit=60")).items;
    return (
      heading(
        "Comparte lo que sabes.",
        "Publica guías y vincula los componentes de cada proyecto.",
        actionButton("Crear artículo", "new-article"),
      ) +
      `<div class="admin-panel">${table(
        ["Título", "Etiqueta", "URL", "Estado", ""],
        cache.articles.map(
          (a) =>
            `<tr><td><strong>${esc(a.title)}</strong><small>${esc(a.excerpt)}</small></td><td>${esc(a.tag)}</td><td>${esc(a.slug)}</td><td>${a.active ? "Publicado" : "Borrador"}</td><td><div class="table-actions">${edit(a.id, "article")}${del(a.id, "article")}</div></td></tr>`,
        ),
      )}</div>`
    );
  }
  if (current === "settings") {
    cache.settings = await api("/admin/settings");
    return settingsPage(cache.settings);
  }
  if (current === "inquiries") {
    cache.inquiries = await api("/admin/inquiries");
    return (
      heading(
        "Cada conversación importa.",
        "Consultas de clientes e instituciones.",
      ) +
      `<div class="admin-panel">${table(
        ["Contacto", "Institución", "Tipo", "Fecha", "Estado", ""],
        cache.inquiries.map(
          (q) =>
            `<tr><td><strong>${esc(q.name)}</strong><small>${esc(q.email)}</small></td><td>${esc(q.organization || "—")}</td><td>${esc(q.kind)}</td><td>${date(q.created_at)}</td><td><span class="badge">${esc(q.status)}</span></td><td><button class="icon-button" data-view-inquiry="${q.id}" aria-label="Abrir solicitud">${icon("eye")}</button></td></tr>`,
        ),
      )}</div>`
    );
  }
  if (current === "roles") {
    cache.roles = await api("/admin/roles");
    const permissions = [
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
    return (
      heading(
        "El acceso correcto.",
        "Los permisos se verifican en cada operación del servidor.",
      ) +
      `<div class="role-grid">${cache.roles.map((r) => `<form class="role-card" data-role="${r.id}"><h3>${esc(r.name)}</h3>${["customer", "super_admin"].includes(r.id) ? '<p class="muted small">Rol protegido del sistema.</p>' : `${permissions.map((p) => checkbox({ products: "Productos y categorías", inventory: "Inventario", orders: "Gestionar pedidos", "orders:read": "Consultar pedidos", customers: "Clientes", content: "Academia", settings: "Contenido y ajustes", promotions: "Promociones", inquiries: "Solicitudes" }[p], p, r.permissions.includes(p))).join("")}${errorBox}<button class="button small full" type="submit">Guardar permisos</button>`}</form>`).join("")}</div>`
    );
  }
}
const lineList = (value) => (value || []).join("\n");
function rowsEditor(kind, items) {
  return `<div data-rows="${kind}">${items.map((x) => row(kind, x)).join("")}</div><button class="text-link" type="button" data-add-row="${kind}">${icon("plus")} Añadir ${{ images: "imagen o video", resources: "recurso", specifications: "especificación", variants: "variante", relations: "relación", quantityDiscounts: "descuento por cantidad", faq: "pregunta" }[kind]}</button>`;
}
function row(kind, x = {}) {
  let fields = "";
  if (kind === "images")
    fields =
      field(
        "URL de imagen o video",
        "url",
        x.url || "",
        "text",
        'placeholder="https://… o /assets/…"',
      ) + select("Formato", "kind", ["image", "video"], x.kind || "image");
  if (kind === "resources")
    fields =
      field("Título", "title", x.title || "") +
      select(
        "Tipo",
        "kind",
        [
          "Datasheet",
          "Manual PDF",
          "Diagrama de conexión",
          "Pinout",
          "Código de ejemplo",
          "Tutorial",
          "Repositorio",
          "STL",
          "Drivers",
          "Software",
          "Video",
          "Enlace",
        ],
        x.kind || "Datasheet",
      ) +
      field("URL HTTPS", "url", x.url || "");
  if (kind === "specifications")
    fields =
      field("Característica", "key", x.key || "") +
      field("Valor", "value", x.value || "");
  if (kind === "variants")
    fields =
      field("Nombre", "name", x.name || "") +
      field("SKU", "sku", x.sku || "") +
      field(
        "Precio USD",
        "price",
        (x.price || 0) / 100,
        "number",
        'min="0" step="0.01"',
      ) +
      field(
        x.id ? "Stock (ajustar en Inventario)" : "Stock inicial",
        "stock",
        x.stock || 0,
        "number",
        `min="0" step="1" ${x.id ? "readonly" : ""}`,
      );
  if (kind === "relations")
    fields =
      select(
        "Producto",
        "related_id",
        (cache.products || []).map((p) => [p.id, p.name]),
        x.related_id,
      ) +
      select(
        "Relación",
        "kind",
        [
          ["related", "Relacionado"],
          ["compatible", "Compatible"],
          ["bundle", "Compra conjunta"],
        ],
        x.kind || "related",
      );
  if (kind === "quantityDiscounts")
    fields =
      field(
        "Desde unidades",
        "quantity",
        x.quantity || 5,
        "number",
        'min="2" max="1000"',
      ) +
      field(
        "Descuento (%)",
        "percent",
        x.percent || 5,
        "number",
        'min="1" max="100"',
      );
  if (kind === "faq")
    fields =
      field("Pregunta", "q", x.q || "") + field("Respuesta", "a", x.a || "");
  return `<div class="repeat-row ${kind === "resources" ? "three" : kind === "variants" ? "four" : ""}" data-row ${x.id ? `data-id="${x.id}"` : ""}>${fields}${["images", "resources"].includes(kind) ? '<label class="upload-field">Subir archivo<input type="file" data-upload accept="image/png,image/jpeg,image/webp,application/pdf"></label>' : ""}<button class="icon-button" type="button" data-remove-row aria-label="Quitar fila">${icon("trash")}</button></div>`;
}
function collectRows(kind) {
  return $$(`[data-rows="${kind}"]>[data-row]`).map((r) => ({
    ...Object.fromEntries($$("input,select", r).map((i) => [i.name, i.value])),
    ...(r.dataset.id ? { id: r.dataset.id } : {}),
  }));
}
function bindRows() {
  const f = $("#product-editor");
  f.addEventListener("change", async (e) => {
    if (!e.target.matches("[data-upload]")) return;
    try {
      const file = e.target.files[0];
      if (!file) return;
      const result = await uploadFile(file);
      const row = e.target.closest("[data-row]");
      row.querySelector("[name=url]").value = result.url;
      if (
        row.querySelector("[name=title]") &&
        !row.querySelector("[name=title]").value
      )
        row.querySelector("[name=title]").value = file.name;
      toast("Archivo guardado. Guarda el producto para vincularlo.");
    } catch (err) {
      toast(err.message);
    }
  });
  f.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add-row]"),
      remove = e.target.closest("[data-remove-row]");
    if (add)
      $(`[data-rows="${add.dataset.addRow}"]`, f).insertAdjacentHTML(
        "beforeend",
        row(add.dataset.addRow),
      );
    if (remove) remove.closest("[data-row]").remove();
  });
}
function productEditor(p = {}) {
  const d = p.details || {};
  modal(
    `<span class="eyebrow">CATÁLOGO</span><h2>${p.id ? "Editar producto" : "Una nueva posibilidad."}</h2><form id="product-editor"><div class="admin-form-grid">${field("Nombre", "name", p.name || "", "text", 'required maxlength="180"')}${field("URL amigable", "slug", p.slug || "", "text", 'required pattern="[a-z0-9]+(-[a-z0-9]+)*"')}${field("SKU", "sku", p.sku || "", "text", "required")}${select("Categoría", "category_id", [["", "Sin categoría"], ...state.categories.map((c) => [c.id, c.name])], p.category_id || "")}${select("Marca", "brand_id", [["", "Sin marca"], ...state.brands.map((b) => [b.id, b.name])], p.brand_id || "")}${field("Nueva marca (opcional)", "new_brand", "")}${field("Precio USD", "price", (p.price || 0) / 100, "number", 'required min="0" step="0.01"')}${field("Precio anterior USD", "compare_price", (p.compare_price || 0) / 100, "number", 'min="0" step="0.01"')}${field(p.id ? "Stock (usar Inventario para ajustar)" : "Stock inicial", "stock", p.stock || 0, "number", `min="0" step="1" ${p.id ? "readonly" : ""}`)}${field("Alerta de stock mínimo", "min_stock", p.min_stock ?? 5, "number", 'min="0" step="1"')}${select(
      "Disponibilidad",
      "status",
      [
        ["available", "Disponible según stock"],
        ["coming", "Próximamente"],
        ["on_order", "Bajo pedido"],
      ],
      p.status || "available",
    )}</div><div class="two-fields">${checkbox("Publicado", "active", p.active)}${checkbox("Destacado en portada", "featured", p.featured)}${checkbox("Producto de demostración", "demo", p.demo ?? state.settings.demo)}${checkbox("Es un kit educativo", "kit", d.kit)}</div>${textarea("Descripción", "description", p.description || "", 'maxlength="16000"')}<details open><summary>Fotografías y videos ${icon("plus")}</summary><p class="small muted">Usa URLs HTTPS o archivos de /assets/. Publica fotografías verificadas del producto real.</p>${rowsEditor("images", p.images || [])}</details><details><summary>Especificaciones y filtros ${icon("plus")}</summary><div class="admin-form-grid">${[
      ["Voltaje", "voltage"],
      ["Corriente", "current"],
      ["Dimensiones", "dimensions"],
      ["Peso", "weight"],
      ["Material", "material"],
      ["Compatibilidad", "compatibility"],
      ["Nivel educativo", "level"],
      ["Edad recomendada", "age"],
      ["Uso", "use"],
      ["Tecnología", "technology"],
      ["Tipo", "type"],
      ["Etiquetas (separadas por coma)", "tags"],
    ]
      .map(([label, key]) => field(label, key, d[key] || ""))
      .join("")}</div>${rowsEditor(
      "specifications",
      Object.entries(d.specifications || {}).map(([key, value]) => ({
        key,
        value,
      })),
    )}</details><details><summary>Variantes ${icon("plus")}</summary><p class="small muted">Las variantes administran su propio precio y stock. Modifica existencias desde Inventario.</p>${rowsEditor("variants", p.variants || [])}</details><details><summary>Biblioteca técnica ${icon("plus")}</summary>${rowsEditor("resources", p.resources || [])}</details><details><summary>Contenido del kit y aplicaciones ${icon("plus")}</summary><div class="admin-form-grid">${textarea("Incluye (un elemento por línea)", "includes", lineList(d.includes))}${textarea("Características (una por línea)", "features", lineList(d.features))}${textarea("Proyectos posibles (uno por línea)", "projects", lineList(d.projects))}${textarea("Aplicaciones educativas (una por línea)", "applications", lineList(d.applications))}${field("Estudiantes por kit", "students", d.students || "")}${field("Software utilizado", "software", d.software || "")}</div>${textarea("Recomendaciones", "recommendations", d.recommendations || "")}${textarea("Nota informativa", "note", d.note || "")}</details><details><summary>Productos relacionados y compatibles ${icon("plus")}</summary>${rowsEditor("relations", p.relations || [])}</details><details><summary>Descuentos por cantidad ${icon("plus")}</summary>${rowsEditor("quantityDiscounts", d.quantityDiscounts || [])}</details><details><summary>SEO ${icon("plus")}</summary>${field("Título SEO", "seoTitle", d.seoTitle || "")}${textarea("Descripción SEO", "seoDescription", d.seoDescription || "")}</details>${errorBox}<div class="editor-actions"><button class="button secondary" type="button" data-close>Cancelar</button><button class="button" type="submit">Guardar producto ${icon("check")}</button></div></form>`,
    "editor-modal",
  );
  bindRows();
  const form = $("#product-editor");
  if (!p.id)
    form.elements.name.oninput = () => {
      if (!form.elements.slug.dataset.edited)
        form.elements.slug.value = slugify(form.elements.name.value);
    };
  form.elements.slug.oninput = () => (form.elements.slug.dataset.edited = "1");
  onForm(form, async (data) => {
    let brand_id = data.brand_id;
    if (data.new_brand)
      brand_id = (await api("/admin/brands", { name: data.new_brand })).id;
    const details = { ...d };
    for (const k of [
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
      details[k] = data[k];
    for (const k of ["includes", "features", "projects", "applications"])
      details[k] = data[k]
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean);
    details.kit = !!data.kit;
    details.specifications = Object.fromEntries(
      collectRows("specifications")
        .filter((r) => r.key)
        .map((r) => [r.key, r.value]),
    );
    details.quantityDiscounts = collectRows("quantityDiscounts").map((r) => ({
      quantity: Number(r.quantity),
      percent: Number(r.percent),
    }));
    const body = {
      ...data,
      brand_id,
      price: Math.round(Number(data.price) * 100),
      compare_price: Math.round(Number(data.compare_price) * 100),
      stock: Number(data.stock),
      min_stock: Number(data.min_stock),
      active: !!data.active,
      featured: !!data.featured,
      demo: !!data.demo,
      details,
      images: collectRows("images")
        .filter((r) => r.url)
        .map((r) => ({ ...r, alt: data.name })),
      resources: collectRows("resources").filter((r) => r.url),
      variants: collectRows("variants").map((v) => ({
        ...v,
        price: Math.round(Number(v.price) * 100),
        stock: Number(v.stock),
      })),
      relations: collectRows("relations"),
    };
    await api(
      "/admin/products" + (p.id ? "/" + p.id : ""),
      body,
      p.id ? "PUT" : "POST",
    );
    closeModal();
    await helpers.refresh();
    state.products.clear();
    toast("Producto guardado.");
    await switchTab("products");
  });
}
function slugify(s) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
function categoryEditor(c = {}) {
  modal(
    `<h2>${c.id ? "Editar categoría" : "Nueva categoría"}</h2><form id="category-editor">${field("Nombre", "name", c.name || "", "text", "required")}${field("URL", "slug", c.slug || "", "text", 'required pattern="[a-z0-9-]+"')}${textarea("Descripción", "description", c.description || "")}${field("URL de imagen", "image", c.image || "")}${uploadField("image")}${select("Categoría padre", "parent_id", [["", "Sin categoría padre"], ...cache.categories.filter((x) => x.id !== c.id).map((x) => [x.id, x.name])], c.parent_id || "")}${field("Orden", "position", c.position || 0, "number", 'min="0" step="1"')}${checkbox("Activa", "active", c.active ?? true)}${errorBox}<button class="button full" type="submit">Guardar categoría</button></form>`,
  );
  bindFieldUploads();
  onForm("#category-editor", async (data) => {
    await api(
      "/admin/categories" + (c.id ? "/" + c.id : ""),
      { ...data, position: Number(data.position), active: !!data.active },
      c.id ? "PUT" : "POST",
    );
    closeModal();
    await helpers.refresh();
    switchTab("categories");
  });
}
function movementEditor() {
  const options = cache.inventory.products.flatMap((p) =>
    p.variants.length
      ? p.variants.map((v) => [
          p.id + ":" + v.id,
          p.name + " · " + v.name + " (" + v.stock + ")",
        ])
      : [[p.id, p.name + " (" + p.stock + ")"]],
  );
  modal(
    `<h2>Registrar movimiento</h2><form id="movement-editor">${select("Producto o variante", "target", options)}${field("Unidades (+ entrada / − salida)", "quantity", 1, "number", 'required step="1"')}${textarea("Motivo del movimiento", "reason", "", 'required placeholder="Compra a proveedor, corrección de inventario…"')}${errorBox}<button class="button full" type="submit">Guardar movimiento</button></form>`,
  );
  onForm("#movement-editor", async (data) => {
    const [product_id, variant_id] = data.target.split(":");
    await api("/admin/inventory", {
      product_id,
      variant_id,
      quantity: Number(data.quantity),
      reason: data.reason,
    });
    state.products.clear();
    closeModal();
    toast("Inventario actualizado.");
    switchTab("inventory");
  });
}
function couponEditor(c = {}) {
  modal(
    `<h2>${c.id ? "Editar cupón" : "Nuevo cupón"}</h2><form id="coupon-editor">${field("Código", "code", c.code || "", "text", 'required maxlength="40"')}${select(
      "Tipo",
      "kind",
      [
        ["percent", "Porcentaje"],
        ["fixed", "Monto fijo en USD"],
      ],
      c.kind || "percent",
    )}${field("Valor (% o USD)", "value", c.kind === "fixed" ? c.value / 100 : c.value || 10, "number", 'required min="0.01" step="0.01"')}${field("Compra mínima USD", "min_total", (c.min_total || 0) / 100, "number", 'min="0" step="0.01"')}${field("Máximo de usos", "max_uses", c.max_uses || 100, "number", 'min="1" step="1"')}${field("Desde", "starts_at", c.starts_at || "", "date")}${field("Hasta", "ends_at", c.ends_at || "", "date")}${checkbox("Activo", "active", c.active ?? true)}${errorBox}<button class="button full" type="submit">Guardar cupón</button></form>`,
  );
  onForm("#coupon-editor", async (data) => {
    await api(
      "/admin/coupons" + (c.id ? "/" + c.id : ""),
      {
        ...data,
        value:
          data.kind === "fixed"
            ? Math.round(Number(data.value) * 100)
            : Number(data.value),
        min_total: Math.round(Number(data.min_total) * 100),
        max_uses: Number(data.max_uses),
        active: !!data.active,
      },
      c.id ? "PUT" : "POST",
    );
    closeModal();
    switchTab("coupons");
  });
}
function articleEditor(a = {}) {
  modal(
    `<h2>${a.id ? "Editar artículo" : "Comparte una nueva idea."}</h2><form id="article-editor"><div class="admin-form-grid">${field("Título", "title", a.title || "", "text", "required")}${field("URL amigable", "slug", a.slug || "", "text", 'required pattern="[a-z0-9-]+"')}${field("Etiqueta", "tag", a.tag || "Guía")}${field("Imagen HTTPS o /assets/", "image", a.image || "")}${uploadField("image")}</div>${textarea("Resumen", "excerpt", a.excerpt || "")}${textarea("Contenido (párrafos separados por una línea en blanco)", "body", a.body || "", 'rows="12" required')}<details><summary>Productos de este proyecto ${icon("plus")}</summary>${cache.catalog.map((p) => checkbox(esc(p.name), "product_" + p.id, a.product_ids?.includes(p.id))).join("")}</details>${checkbox("Publicado", "active", a.active)}${errorBox}<div class="editor-actions"><button class="button" type="submit">Guardar artículo</button></div></form>`,
    "editor-modal",
  );
  bindFieldUploads();
  onForm("#article-editor", async (data) => {
    const product_ids = Object.keys(data)
      .filter((k) => k.startsWith("product_"))
      .map((k) => k.slice(8));
    await api(
      "/admin/articles" + (a.id ? "/" + a.id : ""),
      { ...data, active: !!data.active, product_ids },
      a.id ? "PUT" : "POST",
    );
    closeModal();
    switchTab("articles");
  });
}
function orderView(o) {
  const transitions = {
    "Pedido recibido": ["Pago pendiente", "Cancelado"],
    "Pago pendiente": ["Pago confirmado", "Cancelado"],
    "Pago confirmado": ["Preparando pedido", "Cancelado"],
    "Preparando pedido": ["Enviado", "Entregado", "Cancelado"],
    Enviado: ["Entregado"],
    Entregado: [],
    Cancelado: [],
  };
  modal(
    `<span class="eyebrow">${o.demo ? "DEMOSTRACIÓN" : "PEDIDO"}</span><h2>${esc(o.number)}</h2><div class="admin-order-details"><span class="badge">${esc(o.status)}</span><h3>Cliente y entrega</h3><p>${esc(o.customer.name)} · ${esc(o.customer.email)}</p><p>${esc(o.customer.phone)} · ${esc(o.customer.document || "Sin identificación")}</p><p>${esc(o.customer.address)} · ${esc(o.customer.city)}, ${esc(o.customer.province)}</p><p>${o.delivery === "pickup" ? "Retiro en tienda" : "Envío a domicilio"} · ${o.payment_method === "transfer" ? "Transferencia bancaria" : "Pago al retirar"}</p><h3>Productos</h3>${table(
      ["Producto", "Cantidad", "Precio", "Subtotal"],
      o.items.map(
        (i) =>
          `<tr><td>${esc(i.name)}<small>${esc(i.sku)}</small></td><td>${i.quantity}</td><td>${money(i.price)}</td><td>${money(i.price * i.quantity)}</td></tr>`,
      ),
    )}<p class="total-line">Descuento <strong>${money(o.discount)}</strong></p><p class="total-line">Entrega <strong>${money(o.shipping)}</strong></p><p class="total-line">Total <strong>${money(o.total)}</strong></p><h3>Historial</h3>${o.history.map((h) => `<p>${esc(h.status)} · ${date(h.created_at)}</p>`).join("")}${o.payments.some((p) => p.status === "refund_required") ? '<p class="notice">Este pedido requiere gestionar el reembolso con el cliente. No se ha ejecutado un reembolso automático.</p>' : ""}${allowed("orders") ? `<h3>Factura del pedido</h3><p class="small muted">Adjunta el PDF emitido por tu sistema de facturación. Solo el cliente y el equipo autorizado pueden descargarlo.</p><form id="invoice-form"><label class="field"><span>Factura PDF</span><input name="invoice" type="file" accept="application/pdf" required></label>${errorBox}<button class="button small" type="submit">Adjuntar factura</button></form>` : ""}${o.has_invoice ? `<button class="text-link" id="admin-invoice-download">Descargar factura actual</button>` : ""}${allowed("orders") && transitions[o.status].length ? `<form id="order-status">${select("Actualizar estado", "status", transitions[o.status])}<p class="small muted">Confirma el pago únicamente después de verificar su recepción. Una cancelación restituye el inventario.</p>${errorBox}<button class="button full" type="submit">Actualizar pedido</button></form>` : ""}</div>`,
    "wide-modal",
  );
  onForm("#invoice-form", async (_data, f) => {
    const payload = await filePayload(f.elements.invoice.files[0]);
    await api("/admin/orders/" + o.id + "/invoice", payload);
    toast("Factura adjunta. Disponible para el cliente.");
    closeModal();
    switchTab("orders");
  });
  if ($("#admin-invoice-download"))
    $("#admin-invoice-download").onclick = () =>
      downloadInvoice(o.id).catch((e) => toast(e.message));
  onForm("#order-status", async (data) => {
    await api("/admin/orders/" + o.id, data, "PATCH");
    closeModal();
    state.products.clear();
    switchTab("orders");
  });
}
function customerView(c) {
  modal(
    `<h2>${esc(c.name)}</h2><p>${esc(c.email)}<br>${esc(c.phone)}</p><div class="total-line"><span>Pedidos</span><strong>${c.orders}</strong></div><div class="total-line"><span>Compras confirmadas</span><strong>${money(c.spent)}</strong></div><h3>Direcciones</h3>${c.addresses.map((a) => `<p><strong>${esc(a.label)}</strong><br>${esc(a.data.address)} · ${esc(a.data.city)}, ${esc(a.data.province)}</p>`).join("") || "<p>Sin direcciones guardadas.</p>"}${
      allowed("*") && c.id !== state.user.id
        ? `<form id="customer-access">${select(
            "Rol de acceso",
            "role",
            cache.roles.map((r) => [r.id, r.name]),
            c.role,
          )}${checkbox("Cuenta activa", "active", c.active)}${errorBox}<button class="button full" type="submit">Actualizar acceso</button></form>`
        : ""
    }`,
  );
  onForm("#customer-access", async (data) => {
    await api(
      "/admin/users/" + c.id,
      { role: data.role, active: !!data.active },
      "PATCH",
    );
    closeModal();
    switchTab("customers");
  });
}
function inquiryView(q) {
  modal(
    `<span class="eyebrow">${esc(q.kind)}</span><h2>${esc(q.organization || q.name)}</h2><p>${esc(q.name)}<br>${esc(q.email)}<br>${esc(q.phone)}</p><p class="pre-line">${esc(q.message)}</p><form id="inquiry-status">${select("Estado", "status", ["Nueva", "En revisión", "Respondida", "Cerrada"], q.status)}${errorBox}<button class="button full" type="submit">Guardar estado</button></form>`,
  );
  onForm("#inquiry-status", async (data) => {
    await api("/admin/inquiries/" + q.id, data, "PATCH");
    closeModal();
    switchTab("inquiries");
  });
}
function settingsPage(s) {
  return (
    heading(
      "Tu tienda, tu voz.",
      "Edita la portada, la operación y la información comercial.",
    ) +
    `<form id="settings-editor"><div class="settings-grid"><section class="admin-panel"><h3>Portada</h3>${field("Franja superior", "announcement", s.announcement)}${textarea("Título del hero (salto de línea permitido)", "heroTitle", s.heroTitle)}${textarea("Subtítulo", "heroSubtitle", s.heroSubtitle)}${field("Imagen principal", "heroImage", s.heroImage)}${uploadField("heroImage")}${textarea("Texto institucional", "institutionalText", s.institutionalText)}<details><summary>Textos y banners de las secciones ${icon("plus")}</summary>${field("Título de categorías", "categoryTitle", s.categoryTitle)}${field("Título de destacados", "featuredTitle", s.featuredTitle)}${textarea("Título del banner de kits", "kitTitle", s.kitTitle)}${textarea("Texto del banner de kits", "kitText", s.kitText)}${field("Imagen del banner de kits", "kitImage", s.kitImage)}${uploadField("kitImage")}${field("Título institucional", "institutionTitle", s.institutionTitle)}${field("Título Virtus Lab", "labTitle", s.labTitle)}</details><h4>Secciones visibles</h4>${[
      ["categories", "Categorías"],
      ["featured", "Productos destacados"],
      ["kits", "Kits educativos"],
      ["institutions", "Instituciones"],
      ["lab", "Virtus Lab"],
    ]
      .map(([k, label]) =>
        checkbox(label, "section_" + k, s.homeSections.includes(k)),
      )
      .join(
        "",
      )}</section><section class="admin-panel"><h3>Información comercial</h3>${field("Razón social / nombre comercial", "businessName", s.businessName)}${field("RUC / identificación fiscal", "taxId", s.taxId)}${field("Correo de contacto", "email", s.email, "email")}${field("WhatsApp (593… sin +)", "whatsapp", s.whatsapp, "tel")}${textarea("Dirección de retiro", "address", s.address)}${checkbox("Modo demostración", "demo", s.demo)}<p class="small muted">Antes de desactivar demostración, verifica productos, precios, inventario, imágenes y condiciones comerciales.</p></section><section class="admin-panel"><h3>Entrega y pagos</h3>${checkbox("Permitir retiro", "pickupEnabled", s.pickupEnabled)}${checkbox("Permitir envíos", "shippingEnabled", s.shippingEnabled)}${field("Tarifa de envío USD", "shipping", s.shipping / 100, "number", 'min="0" step="0.01"')}${field("Envío gratis desde USD", "freeShipping", s.freeShipping / 100, "number", 'min="0" step="0.01"')}${checkbox("Permitir transferencia bancaria", "transferEnabled", s.transferEnabled)}${textarea("Instrucciones bancarias", "bankInstructions", s.bankInstructions)}<p class="notice">El pago online requiere una integración de pasarela en el servidor. No está habilitado para cobros.</p></section><section class="admin-panel"><h3>Políticas y condiciones</h3>${textarea("Política de privacidad", "privacy", s.privacy, 'rows="7"')}${textarea("Condiciones de compra, entrega y devoluciones", "legal", s.legal, 'rows="7"')}</section></div><section class="admin-panel"><h3>Preguntas frecuentes</h3><div data-rows="faq">${s.faq.map((q) => row("faq", q)).join("")}</div><button class="text-link" type="button" id="add-faq">${icon("plus")} Añadir pregunta</button></section>${errorBox}<button class="button" type="submit">Guardar configuración ${icon("check")}</button></form>`
  );
}
async function confirmDelete(kind, id) {
  modal(
    `<h2>¿Eliminar este registro?</h2><p>La eliminación es permanente. Los productos con pedidos asociados deben desactivarse para conservar su historial.</p><div class="two-fields"><button class="button secondary" data-close>Cancelar</button><button class="button" id="confirm-delete">Eliminar</button></div>`,
  );
  $("#confirm-delete").onclick = async () => {
    try {
      await api("/admin/" + kind + "/" + id, {}, "DELETE");
      closeModal();
      await helpers.refresh();
      state.products.clear();
      switchTab(current);
    } catch (e) {
      toast(e.message);
    }
  };
}
export function bindAdmin() {
  if (!$("#admin-content")) return;
  bindFieldUploads();
  $$("[data-admin-tab]").forEach(
    (b) => (b.onclick = () => switchTab(b.dataset.adminTab)),
  );
  if ($("#admin-search"))
    $("#admin-search").oninput = (e) =>
      $$("[data-search-row]").forEach(
        (r) =>
          (r.hidden = !r.dataset.searchRow.includes(
            e.target.value.toLowerCase(),
          )),
      );
  const bind = (selector, fn) =>
    $$(selector).forEach((b) => (b.onclick = () => fn(b)));
  if ($("#new-product")) $("#new-product").onclick = () => productEditor();
  bind("[data-edit-product]", (b) =>
    productEditor(cache.products.find((p) => p.id === b.dataset.editProduct)),
  );
  bind("[data-delete-product]", (b) =>
    confirmDelete("products", b.dataset.deleteProduct),
  );
  bind("[data-duplicate]", async (b) => {
    try {
      await api("/admin/products/" + b.dataset.duplicate + "/duplicate", {});
      toast("Copia creada como borrador, sin stock.");
      switchTab("products");
    } catch (e) {
      toast(e.message);
    }
  });
  if ($("#new-category")) $("#new-category").onclick = () => categoryEditor();
  bind("[data-edit-category]", (b) =>
    categoryEditor(
      cache.categories.find((c) => c.id === b.dataset.editCategory),
    ),
  );
  bind("[data-delete-category]", (b) =>
    confirmDelete("categories", b.dataset.deleteCategory),
  );
  if ($("#new-movement")) $("#new-movement").onclick = movementEditor;
  if ($("#new-coupon")) $("#new-coupon").onclick = () => couponEditor();
  bind("[data-edit-coupon]", (b) =>
    couponEditor(cache.coupons.find((c) => c.id === b.dataset.editCoupon)),
  );
  if ($("#new-article")) $("#new-article").onclick = () => articleEditor();
  bind("[data-edit-article]", (b) =>
    articleEditor(cache.articles.find((a) => a.id === b.dataset.editArticle)),
  );
  bind("[data-delete-article]", (b) =>
    confirmDelete("articles", b.dataset.deleteArticle),
  );
  bind("[data-view-order]", (b) =>
    orderView(cache.orders.find((o) => o.id === b.dataset.viewOrder)),
  );
  bind("[data-view-customer]", (b) =>
    customerView(cache.customers.find((c) => c.id === b.dataset.viewCustomer)),
  );
  bind("[data-view-inquiry]", (b) =>
    inquiryView(cache.inquiries.find((q) => q.id === b.dataset.viewInquiry)),
  );
  $$("[data-role]").forEach((f) =>
    onForm(f, async (data) => {
      await api(
        "/admin/roles/" + f.dataset.role,
        { permissions: Object.keys(data) },
        "PUT",
      );
      toast("Permisos actualizados.");
    }),
  );
  if ($("#add-faq"))
    $("#add-faq").onclick = () => {
      $('[data-rows="faq"]').insertAdjacentHTML("beforeend", row("faq"));
      bindFaqRemove();
    };
  function bindFaqRemove() {
    $$("[data-remove-row]", $("#settings-editor")).forEach(
      (b) => (b.onclick = () => b.closest("[data-row]").remove()),
    );
  }
  if ($("#settings-editor")) bindFaqRemove();
  onForm("#settings-editor", async (data) => {
    const s = { ...cache.settings };
    for (const key of Object.keys(s)) {
      if (["homeSections", "faq"].includes(key)) continue;
      if (typeof s[key] === "boolean") s[key] = !!data[key];
      else if (["shipping", "freeShipping"].includes(key))
        s[key] = Math.round(Number(data[key]) * 100);
      else if (key in data) s[key] = data[key];
    }
    s.homeSections = [
      "categories",
      "featured",
      "kits",
      "institutions",
      "lab",
    ].filter((k) => data["section_" + k]);
    s.faq = collectRows("faq").filter((r) => r.q && r.a);
    await api("/admin/settings", s, "PUT");
    await helpers.refresh();
    toast("Configuración actualizada.");
    cache.settings = s;
  });
}

async function uploadFile(file) {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("El archivo debe pesar menos de 10 MB.");
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return api("/admin/uploads", { name: file.name, data });
}

function uploadField(target) {
  return `<label class="upload-field">Subir imagen<input type="file" data-field-upload="${target}" accept="image/png,image/jpeg,image/webp"></label>`;
}
function bindFieldUploads() {
  $$("[data-field-upload]").forEach(
    (input) =>
      (input.onchange = async () => {
        try {
          const result = await uploadFile(input.files[0]);
          input.closest("form").elements[input.dataset.fieldUpload].value =
            result.url;
          toast("Imagen cargada. Guarda los cambios para publicarla.");
        } catch (e) {
          toast(e.message);
        }
      }),
  );
}
