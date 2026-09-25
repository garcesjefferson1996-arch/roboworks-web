import { showroom, bindShowroom } from "./showroom.js";
import {
  $,
  $$,
  esc,
  money,
  date,
  api,
  icon,
  logo,
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
  downloadInvoice,
} from "./ui.js";
const state = {
  settings: {},
  categories: [],
  brands: [],
  user: null,
  products: new Map(),
  cart: readLocal("virtus.cart", []),
  favorites: readLocal("virtus.favorites", []),
  compare: readLocal("virtus.compare", []),
};
function readLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}
function persist() {
  try {
    localStorage.setItem("virtus.cart", JSON.stringify(state.cart));
    localStorage.setItem("virtus.favorites", JSON.stringify(state.favorites));
    localStorage.setItem("virtus.compare", JSON.stringify(state.compare));
  } catch {
    toast("El navegador no permite guardar preferencias.");
  }
  updateCounts();
}
const remember = (p) => {
  state.products.set(p.id, p);
  return p;
};
const loadProduct = async (id) =>
  state.products.get(id) ||
  remember(await api("/products/" + encodeURIComponent(id)));
const img = (p) =>
  p.images?.find((i) => i.kind === "image")?.url || "/assets/favicon.svg";
const stock = (p) =>
  p.variants?.length ? p.variants.reduce((s, v) => s + v.stock, 0) : p.stock;
const stockText = (p) =>
  p.status === "coming"
    ? "Próximamente"
    : p.status === "on_order"
      ? "Bajo pedido"
      : stock(p) === 0
        ? "Agotado"
        : stock(p) <= p.min_stock
          ? "Pocas unidades"
          : "Disponible";
const navItems = [
  ["Inicio", "/"],
  ["Productos", "/productos"],
  ["Categorías", "/productos?categories=1"],
  ["Kits educativos", "/kits"],
  ["Robótica", "/categoria/robotica"],
  ["Electrónica", "/productos"],
  ["Impresión 3D", "/categoria/impresion-3d"],
  ["Instituciones", "/instituciones"],
  ["Ofertas", "/productos?offers=1"],
  ["Contacto", "/contacto"],
];
export async function navigate(path) {
  history.pushState({}, "", path);
  closeModal();
  await render();
  window.scrollTo({ top: 0, behavior: "instant" });
  $("#main").focus({ preventScroll: true });
}
function header() {
  $("#header").innerHTML =
    `<div class="announcement"><span>${esc(state.settings.announcement)}</span><span>Ecuador · USD ${icon("box")}</span></div><header class="header"><a class="brand" data-link href="/" aria-label="Virtus Electrónica, inicio">${logo()}</a><nav class="desktop-nav" aria-label="Navegación principal"><div class="nav-dropdown"><a data-link href="/productos">Productos</a><div class="nav-dropdown-menu">${navItems.map(([name, path]) => `<a href="${path}" data-link>${name}</a>`).join("")}</div></div><a data-link href="/kits">Kits educativos</a><a data-link href="/categoria/robotica">Robótica</a><a data-link href="/instituciones">Instituciones</a><a data-link href="/lab">Virtus Lab ${icon("arrow")}</a></nav><div class="header-actions"><button class="icon-button" data-search aria-label="Buscar productos">${icon("search")}</button><a class="icon-button account-link" href="/cuenta" data-link aria-label="Mi cuenta">${icon("user")}</a><a class="icon-button favorites-link" href="/favoritos" data-link aria-label="Favoritos">${icon("heart")}<span id="favorite-count" class="small-count"></span></a><button class="icon-button" data-cart aria-label="Abrir carrito">${icon("bag")}<span id="cart-count" class="cart-count">0</span></button><button class="icon-button mobile-menu-button" data-menu aria-label="Abrir menú" aria-expanded="false">${icon("menu")}</button></div></header><nav id="mobile-nav" class="mobile-nav" hidden aria-label="Menú móvil">${navItems.map(([name, path]) => `<a data-link href="${path}">${name}${icon("chevron")}</a>`).join("")}<a data-link href="/lab">Virtus Lab</a><a data-link href="/cuenta">Mi cuenta</a><a data-link href="/favoritos">Favoritos</a></nav>`;
  updateCounts();
}
function updateCounts() {
  const count = state.cart.reduce((s, p) => s + p.quantity, 0);
  if ($("#cart-count")) $("#cart-count").textContent = count;
  if ($("#favorite-count"))
    $("#favorite-count").textContent = state.favorites.length || "";
}
function footer() {
  const s = state.settings;
  $("#footer").innerHTML =
    `<div class="footer-top"><div><a class="brand" href="/" data-link>${logo()}</a><p>Tecnología para aprender.<br>Tecnología para crear.</p><span class="eyebrow">HECHO PARA MENTES CURIOSAS.</span></div><div><h4>Explora</h4><a data-link href="/productos">Todos los productos</a><a data-link href="/kits">Kits educativos</a><a data-link href="/productos?offers=1">Ofertas</a><a data-link href="/comparar">Comparar productos</a></div><div><h4>Aprende y conecta</h4><a data-link href="/lab">Virtus Lab</a><a data-link href="/instituciones">Instituciones</a><a data-link href="/contacto">Contacto y soporte</a><a data-link href="/cuenta">Mi cuenta</a></div><div><h4>Construyamos algo.</h4><p>¿Una idea, un proyecto, un laboratorio?</p><a class="text-link" data-link href="/contacto">Conversemos ${icon("arrow")}</a>${s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : ""}</div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} VIRTUS Electrónica · Ecuador</span><div><a href="/privacidad" data-link>Privacidad</a><a href="/condiciones" data-link>Condiciones</a><a href="/admin" data-link>Administración</a></div></div>${s.demo ? '<div class="demo-note">Entorno de demostración · Productos, precios e imágenes conceptuales de ejemplo. No se procesan cobros online.</div>' : ""}`;
}
function card(p) {
  remember(p);
  const discount =
    p.compare_price > p.price
      ? Math.round(100 - (p.price / p.compare_price) * 100)
      : 0;
  return `<article class="product-card"><div class="product-image"><a href="/productos/${p.slug}" data-link><img src="${esc(img(p))}" alt="${esc(p.name)}" loading="lazy" width="480" height="480"></a><div class="product-badges">${discount ? `<span class="badge sale">−${discount}%</span>` : p.details.kit ? '<span class="badge">APRENDE CREANDO</span>' : ""}</div><button class="icon-button favorite ${state.favorites.includes(p.id) ? "selected" : ""}" data-favorite="${p.id}" aria-label="Guardar ${esc(p.name)} en favoritos" aria-pressed="${state.favorites.includes(p.id)}">${icon("heart")}</button><div class="quick-actions"><button data-quick="${p.id}">${icon("eye")} Vista rápida</button><button data-compare="${p.id}" aria-label="Comparar ${esc(p.name)}">${icon("compare")}</button></div></div><div class="product-info"><span class="product-category">${esc(p.category || "Electrónica")}</span><h3><a href="/productos/${p.slug}" data-link>${esc(p.name)}</a></h3><p class="stock ${stock(p) ? "" : "out"}"><span></span>${stockText(p)}</p><div class="product-bottom"><div><strong>${money(p.price)}</strong>${discount ? `<del>${money(p.compare_price)}</del>` : ""}</div><button class="add-button" data-add="${p.id}" aria-label="Añadir ${esc(p.name)} al carrito" ${!stock(p) || p.status !== "available" ? "disabled" : ""}>${icon("plus")}</button></div></div></article>`;
}
function categoryCard(c, i) {
  return `<a class="category-card" href="/categoria/${esc(c.slug)}" data-link><span class="category-number">0${i + 1}</span><img src="${esc(c.image || "/assets/favicon.svg")}" alt="" loading="lazy"><div><h3>${esc(c.name)}</h3><span>${esc(c.description)}</span></div>${icon("arrow")}</a>`;
}
let showroomProducts = [];
async function home() {
  const result = await api("/products?featured=1&limit=8");
  showroomProducts = result.items;
  showroomProducts.forEach(remember);
  return showroom(showroomProducts);
}
function articleCard(a) {
  return `<a class="article-card" href="/lab/${esc(a.slug)}" data-link><img src="${esc(a.image || "/assets/hero.webp")}" alt="" loading="lazy"><div><span class="eyebrow">${esc(a.tag)}</span><h3>${esc(a.title)}</h3><p>${esc(a.excerpt)}</p><span class="text-link">Explorar guía ${icon("arrow")}</span></div></a>`;
}
function catalogFilters(params) {
  const values = (key) => params.get(key) || "";
  return `<form id="filters"><div class="filter-head"><h3>${icon("sliders")} Filtrar</h3><a href="/productos" data-link>Limpiar</a></div>${field("Buscar", "q", values("q"), "search", 'placeholder="Nombre, modelo o SKU"')}${select("Categoría", "category", [["", "Todas las categorías"], ...state.categories.map((c) => [c.slug, c.name])], values("category"))}${select("Marca", "brand", [["", "Todas las marcas"], ...state.brands.map((b) => [b.name, b.name])], values("brand"))}<div class="two-fields">${field("Desde (USD)", "min", values("min") ? values("min") / 100 : "", "number", 'min="0" step="0.01"')}${field("Hasta (USD)", "max", values("max") ? values("max") / 100 : "", "number", 'min="0" step="0.01"')}</div><label class="checkbox"><input type="checkbox" name="stock" value="1" ${values("stock") ? "checked" : ""}> Solo disponibles</label><label class="checkbox"><input type="checkbox" name="offers" value="1" ${values("offers") ? "checked" : ""}> En oferta</label><details><summary>Características técnicas ${icon("plus")}</summary>${select("Voltaje", "voltage", [["", "Todos"], "3.3 V", "5 V", "6 V", "12 V"], values("voltage"))}${field("Compatibilidad", "compatibility", values("compatibility"))}${field("Tecnología", "technology", values("technology"))}${field("Tipo", "type", values("type"))}</details><details><summary>Para tu proyecto ${icon("plus")}</summary>${select("Nivel", "level", [["", "Todos"], "Inicial", "Intermedio", "Avanzado"], values("level"))}${field("Edad recomendada", "age", values("age"))}${field("Uso", "use", values("use"))}</details><button class="button full" type="submit">Aplicar filtros</button></form>`;
}
async function catalog() {
  const params = new URLSearchParams(location.search),
    slug = location.pathname.split("/")[2];
  if (slug) params.set("category", slug);
  if (location.pathname === "/kits") params.set("kits", "1");
  const data = await api("/products?" + params),
    category = state.categories.find((c) => c.slug === params.get("category")),
    title =
      location.pathname === "/kits"
        ? "Aprender haciendo."
        : category?.name || "Tu próxima gran idea empieza aquí.";
  return `<section class="page-heading wrap"><div class="breadcrumbs"><a href="/" data-link>Inicio</a><span>/</span> ${category ? "Categorías" : "Explora"}</div><span class="eyebrow">${location.pathname === "/kits" ? "KITS EDUCATIVOS" : "EL UNIVERSO VIRTUS"}</span><h1>${esc(title)}</h1><p>${esc(category?.description || "Encuentra las piezas que conectan tu imaginación con el mundo real.")}</p></section>${params.has("categories") ? `<div class="category-grid wrap all-categories">${state.categories.map(categoryCard).join("")}</div>` : ""}<section class="catalog-layout wrap"><aside class="filters">${catalogFilters(params)}</aside><div><div class="catalog-toolbar"><span><strong>${data.total}</strong> productos para crear</span><button class="button small secondary filter-toggle">${icon("sliders")} Filtros</button><label class="sort-label">Ordenar <select id="sort" aria-label="Ordenar productos">${[
    ["featured", "Destacados"],
    ["price", "Menor precio"],
    ["expensive", "Mayor precio"],
    ["name", "Nombre"],
    ["new", "Novedades"],
  ]
    .map(
      ([val, text]) =>
        `<option value="${val}" ${params.get("sort") === val ? "selected" : ""}>${text}</option>`,
    )
    .join(
      "",
    )}</select></label></div><div class="product-grid catalog-grid">${data.items.map(card).join("")}</div>${!data.items.length ? empty("Todavía no encontramos esa pieza.", "Prueba otro término o cambia los filtros.") : ""}<div class="pagination">${Array.from({ length: data.pages }, (_, i) => `<button class="${data.page === i + 1 ? "active" : ""}" data-page="${i + 1}">${i + 1}</button>`).join("")}</div></div></section>`;
}
function technical(p) {
  const d = p.details;
  return `<div class="product-sections"><section><h2>Diseñado para tus ideas.</h2><p>${esc(p.description)}</p>${d.features?.length ? `<ul class="check-list">${d.features.map((t) => `<li>${icon("check")}${esc(t)}</li>`).join("")}</ul>` : ""}${d.note ? `<p class="notice">${esc(d.note)}</p>` : ""}</section><section><h2>En detalle.</h2><dl class="specs">${Object.entries(
    d.specifications || {},
  )
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
    .join("")}${[
    ["Compatibilidad", d.compatibility],
    ["Corriente", d.current],
    ["Dimensiones", d.dimensions],
    ["Peso", d.weight],
    ["Material", d.material],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
    .join(
      "",
    )}</dl></section><section><h2>En la caja.</h2><ul>${(d.includes || []).map((v) => `<li>${esc(v)}</li>`).join("")}</ul></section><section id="documentacion"><h2>El conocimiento también viene incluido.</h2><p>Documentación y recursos técnicos para dar el siguiente paso.</p><div class="resource-list">${p.resources.length ? p.resources.map((r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${icon("download")}<span><strong>${esc(r.title)}</strong><small>${esc(r.kind)}</small></span>${icon("arrow")}</a>`).join("") : '<p class="muted">Aún no se han publicado recursos para este producto. Solicítalos a nuestro equipo.</p>'}</div></section>${d.kit ? `<section><h2>Mucho más que un kit.</h2><div class="kit-stats"><div><small>Nivel</small><strong>${esc(d.level || "Por confirmar")}</strong></div><div><small>Edad</small><strong>${esc(d.age || "Por confirmar")}</strong></div><div><small>Estudiantes</small><strong>${esc(d.students || "Por confirmar")}</strong></div><div><small>Software</small><strong>${esc(d.software || "Por confirmar")}</strong></div></div><h3>¿Qué puedes construir?</h3><ul>${(d.projects || []).map((v) => `<li>${esc(v)}</li>`).join("")}</ul></section>` : ""}${d.applications?.length ? `<section><h2>Ideas para empezar.</h2><ul>${d.applications.map((v) => `<li>${esc(v)}</li>`).join("")}</ul></section>` : ""}${d.recommendations ? `<section><h2>Antes de empezar.</h2><p>${esc(d.recommendations)}</p></section>` : ""}</div>`;
}
async function productPage() {
  const p = remember(
    await api("/products/" + location.pathname.split("/").pop()),
  );
  const related = await api(
    "/products?category=" + p.category_slug + "&limit=4",
  );
  return `<div class="wrap product-page"><div class="breadcrumbs"><a href="/" data-link>Inicio</a><span>/</span><a href="/categoria/${p.category_slug}" data-link>${esc(p.category)}</a><span>/</span>${esc(p.name)}</div><div class="product-detail"><div class="gallery"><button class="main-photo" data-zoom="${p.id}" aria-label="Ampliar imagen"><img id="main-product-image" src="${esc(img(p))}" alt="${esc(p.name)}"></button><div class="thumbnails">${p.images
    .filter((i) => i.kind === "image")
    .map(
      (i, n) =>
        `<button data-image="${esc(i.url)}" class="${n === 0 ? "active" : ""}" aria-label="Ver imagen ${n + 1}"><img src="${esc(i.url)}" alt="${esc(i.alt)}"></button>`,
    )
    .join("")}</div>${p.images
    .filter((i) => i.kind === "video")
    .map((i) => `<video controls preload="none" src="${esc(i.url)}"></video>`)
    .join(
      "",
    )}</div><div class="purchase-info"><span class="eyebrow">${esc(p.category)}</span><h1>${esc(p.name)}</h1><span class="sku">SKU ${esc(p.sku)} ${p.demo ? "· DEMOSTRACIÓN" : ""}</span><p>${esc(p.description)}</p><div class="detail-price"><strong id="variant-price">${money(p.price)}</strong>${p.compare_price > p.price ? `<del>${money(p.compare_price)}</del>` : ""}</div><p class="stock ${stock(p) ? "" : "out"}"><span></span><span id="variant-stock">${stockText(p)} · ${stock(p)} unidades</span></p><form id="purchase-form" data-product="${p.id}">${
    p.variants.length
      ? select(
          "Elige tu versión",
          "variant_id",
          p.variants.map((v) => [v.id, v.name + " · " + money(v.price)]),
        )
      : ""
  }<div class="purchase-actions">${field("Cantidad", "quantity", 1, "number", `required min="1" max="${p.variants[0]?.stock ?? p.stock}"`)}<button class="button" type="submit" ${!stock(p) || p.status !== "available" ? "disabled" : ""}>${icon("bag")} Añadir al carrito</button></div><button class="button secondary full" type="button" id="buy-now" ${!stock(p) || p.status !== "available" ? "disabled" : ""}>Comprar ahora ${icon("right")}</button></form><div class="detail-links"><button data-favorite="${p.id}">${icon("heart")} Guardar</button><button data-compare="${p.id}">${icon("compare")} Comparar</button><button data-consult="${p.id}">${icon("chat")} Consultar</button></div><div class="purchase-assurance">${icon("truck")} Envío en Ecuador o retiro ${icon("book")} Recursos técnicos</div></div></div><nav class="product-tabs"><a href="#descripcion">Descripción</a><a href="#documentacion">Documentación</a><a href="#relacionados">Para tu proyecto</a></nav><div id="descripcion">${technical(p)}</div><section class="section" id="relacionados"><div class="section-heading"><h2>Juntos, más posibilidades.</h2></div><div class="product-grid">${(
    await Promise.all(
      p.relations.map((r) => loadProduct(r.related_id).catch(() => null)),
    )
  )
    .filter(Boolean)
    .concat(
      related.items.filter(
        (x) => x.id !== p.id && !p.relations.some((r) => r.related_id === x.id),
      ),
    )
    .slice(0, 4)
    .map(card)
    .join("")}</div></section></div>`;
}
async function addToCart(pid, quantity = 1, variant_id = null, open = true) {
  const p = await loadProduct(pid);
  if (p.variants.length && !variant_id) {
    await navigate("/productos/" + p.slug);
    toast("Selecciona la versión que necesitas.");
    return;
  }
  const source = p.variants.find((v) => v.id === variant_id) || p;
  if (!Number.isInteger(quantity) || quantity < 1)
    throw new Error("Ingresa una cantidad válida.");
  const existing = state.cart.find(
    (c) => c.product_id === pid && c.variant_id === variant_id,
  );
  if ((existing?.quantity || 0) + quantity > source.stock)
    throw new Error("No hay suficientes unidades disponibles.");
  if (p.status !== "available")
    throw new Error("Este producto todavía no se puede comprar.");
  if (existing) existing.quantity += quantity;
  else state.cart.push({ product_id: pid, variant_id, quantity });
  persist();
  if (open) await cartDrawer();
}
async function cartRows() {
  return Promise.all(
    state.cart.map(async (line) => {
      try {
        const p = await loadProduct(line.product_id),
          v = p.variants.find((v) => v.id === line.variant_id);
        return {
          ...line,
          p,
          price: v?.price ?? p.price,
          name: p.name + (v ? " · " + v.name : ""),
          stock: v?.stock ?? p.stock,
        };
      } catch {
        return {
          ...line,
          p: null,
          price: 0,
          name: "Producto no disponible",
          stock: 0,
        };
      }
    }),
  );
}
async function cartDrawer() {
  const rows = await cartRows();
  let estimate;
  try {
    estimate = rows.length
      ? await api("/quote", {
          items: state.cart,
          delivery: state.settings.pickupEnabled ? "pickup" : "shipping",
        })
      : null;
  } catch {}
  const d = modal(
    `<div class="drawer-head"><span class="eyebrow">EL INICIO DE ALGO GRANDE</span><h2>Tu carrito <span>(${state.cart.reduce((s, p) => s + p.quantity, 0)})</span></h2></div>${rows.length ? `<div class="cart-items">${rows.map((r, i) => `<div class="cart-item"><img src="${esc(r.p ? img(r.p) : "/assets/favicon.svg")}" alt=""><div><h3>${esc(r.name)}</h3><span>${money(r.price)}</span><div class="quantity-control"><button data-qty="${i}" data-delta="-1" aria-label="Disminuir cantidad">${icon("minus")}</button><span>${r.quantity}</span><button data-qty="${i}" data-delta="1" aria-label="Aumentar cantidad" ${r.quantity >= r.stock ? "disabled" : ""}>${icon("plus")}</button></div></div><button class="icon-button" data-remove="${i}" aria-label="Quitar ${esc(r.name)}">${icon("trash")}</button></div>`).join("")}</div><div class="drawer-bottom"><div class="total-line"><span>Subtotal</span><strong>${money(estimate ? estimate.subtotal : rows.reduce((s, r) => s + r.price * r.quantity, 0))}</strong></div><p>Entrega y descuentos calculados al finalizar.</p>${state.settings.demo ? '<p class="notice">Pedido de demostración. No se realizará ningún cobro.</p>' : ""}<a class="button full" href="/checkout" data-link>Continuar con mi compra ${icon("right")}</a><button class="text-link full" data-close>Seguir explorando</button></div>` : empty("Las buenas ideas empiezan con una pieza.", "Explora el catálogo y encuentra la tuya.")}`,
    "cart-drawer",
  );
  $$("[data-qty]", d).forEach(
    (b) =>
      (b.onclick = async () => {
        const i = Number(b.dataset.qty),
          next = state.cart[i].quantity + Number(b.dataset.delta);
        if (next === 0) state.cart.splice(i, 1);
        else state.cart[i].quantity = next;
        persist();
        await cartDrawer();
      }),
  );
  $$("[data-remove]", d).forEach(
    (b) =>
      (b.onclick = async () => {
        state.cart.splice(Number(b.dataset.remove), 1);
        persist();
        await cartDrawer();
      }),
  );
}
async function favorite(pid) {
  if (state.favorites.includes(pid)) {
    if (state.user) await api("/favorites/" + pid, {}, "DELETE");
    state.favorites = state.favorites.filter((id) => id !== pid);
  } else {
    if (state.user) await api("/favorites/" + pid, {}, "PUT");
    state.favorites.push(pid);
  }
  persist();
  $$(`[data-favorite="${pid}"]`).forEach((b) => {
    b.classList.toggle("selected", state.favorites.includes(pid));
    b.setAttribute("aria-pressed", state.favorites.includes(pid));
  });
  toast(
    state.favorites.includes(pid)
      ? "Guardado en tus favoritos."
      : "Producto eliminado de favoritos.",
  );
  if (location.pathname === "/favoritos") await render();
}
function compare(pid) {
  if (state.compare.includes(pid)) {
    state.compare = state.compare.filter((id) => id !== pid);
    toast("Producto retirado de la comparación.");
  } else {
    if (state.compare.length >= 4) {
      toast("Puedes comparar hasta 4 productos.");
      return;
    }
    state.compare.push(pid);
    toast("Añadido. Abre «Comparar productos» desde el pie de página.");
  }
  persist();
  if (location.pathname === "/comparar") render();
  else {
    const t = $("#toast");
    const a = document.createElement("a");
    a.href = "/comparar";
    a.dataset.link = "";
    a.textContent = " Ver comparación →";
    t.appendChild(a);
  }
}
async function savedPage(compareMode = false) {
  const list = await Promise.all(
      (compareMode ? state.compare : state.favorites).map((id) =>
        loadProduct(id).catch(() => null),
      ),
    ),
    products = list.filter(Boolean);
  return `<section class="wrap section page-heading"><span class="eyebrow">TU ESPACIO VIRTUS</span><h1>${compareMode ? "Encuentra tu mejor opción." : "Ideas para después."}</h1>${
    products.length
      ? compareMode
        ? `<div class="table-scroll"><table class="compare-table"><thead><tr><th>Compara</th>${products.map((p) => `<th><img src="${esc(img(p))}" alt=""><a href="/productos/${p.slug}" data-link>${esc(p.name)}</a><button class="text-link" data-compare="${p.id}">Quitar</button></th>`).join("")}</tr></thead><tbody>${[
            ["Precio", (p) => money(p.price)],
            ["Disponibilidad", stockText],
            ["Categoría", (p) => p.category],
            ["Voltaje", (p) => p.details.voltage],
            ["Compatibilidad", (p) => p.details.compatibility],
            ["Nivel", (p) => p.details.level],
            ["Edad", (p) => p.details.age],
            ["Tecnología", (p) => p.details.technology],
          ]
            .map(
              ([label, fn]) =>
                `<tr><th>${label}</th>${products.map((p) => `<td>${esc(fn(p) || "No especificado")}</td>`).join("")}</tr>`,
            )
            .join(
              "",
            )}<tr><th>Tu proyecto</th>${products.map((p) => `<td><button class="button small" data-add="${p.id}" ${!stock(p) ? "disabled" : ""}>Añadir ${icon("plus")}</button></td>`).join("")}</tr></tbody></table></div>`
        : `<div class="product-grid">${products.map(card).join("")}</div>`
      : empty(
          compareMode
            ? "Cada proyecto tiene su mejor opción."
            : "Guarda lo que te inspira.",
          compareMode
            ? "Selecciona hasta cuatro productos con el icono de comparar."
            : "Toca el corazón de un producto para volver a él cuando quieras.",
        )
  }</section>`;
}
function searchDialog() {
  modal(
    `<div class="search-dialog"><span class="eyebrow">ENCUENTRA TU PRÓXIMA IDEA</span><form id="search-form"><label class="search-input">${icon("search")}<input id="search-input" name="q" type="search" placeholder="Prueba con ESP32, servo, un kit…" autocomplete="off" aria-label="Buscar productos, categorías y recursos" autofocus></label></form><div id="search-results"><p class="muted">Busca por nombre, modelo o componente.</p><div class="search-suggestions">${["Arduino", "ESP32", "Servo", "Kit"].map((s) => `<button data-suggestion="${s}">${s}${icon("arrow")}</button>`).join("")}</div></div></div>`,
    "search-modal",
  );
  let timer,
    sequence = 0;
  const search = async () => {
    const n = ++sequence,
      q = $("#search-input")?.value.trim();
    if (!q) {
      $("#search-results").innerHTML =
        '<p class="muted">Escribe para explorar.</p>';
      return;
    }
    try {
      const r = await api("/search?q=" + encodeURIComponent(q));
      if (n !== sequence || !$("#search-results")) return;
      $("#search-results").innerHTML = `${
        r.products.length
          ? `<h4>Productos</h4>${r.products
              .map((p) => {
                remember(p);
                return `<a href="/productos/${p.slug}" class="search-result" data-link><img src="${esc(img(p))}" alt=""><span><strong>${esc(p.name)}</strong><small>${esc(p.category)}</small></span><b>${money(p.price)}</b>${icon("chevron")}</a>`;
              })
              .join("")}`
          : ""
      }${r.categories.length ? `<h4>Categorías</h4>${r.categories.map((c) => `<a class="search-result" href="/categoria/${c.slug}" data-link>${icon("grid")}${esc(c.name)}${icon("right")}</a>`).join("")}` : ""}${r.articles.length ? `<h4>Virtus Lab</h4>${r.articles.map((a) => `<a class="search-result" href="/lab/${a.slug}" data-link>${icon("book")}${esc(a.title)}</a>`).join("")}` : ""}${!r.products.length && !r.categories.length && !r.articles.length ? "<p>No encontramos resultados. Prueba un término más corto.</p>" : `<a class="text-link" data-link href="/productos?q=${encodeURIComponent(q)}">Ver todos los resultados ${icon("right")}</a>`}`;
    } catch (e) {
      toast(e.message);
    }
  };
  $("#search-input").oninput = () => {
    clearTimeout(timer);
    timer = setTimeout(search, 180);
  };
  $("#search-form").onsubmit = (e) => {
    e.preventDefault();
    navigate("/productos?q=" + encodeURIComponent($("#search-input").value));
  };
  $$("[data-suggestion]").forEach(
    (b) =>
      (b.onclick = () => {
        $("#search-input").value = b.dataset.suggestion;
        search();
      }),
  );
}
async function quickView(pid) {
  const p = await loadProduct(pid);
  modal(
    `<div class="quick-view"><img src="${esc(img(p))}" alt="${esc(p.name)}"><div><span class="eyebrow">${esc(p.category)}</span><h2>${esc(p.name)}</h2><p>${esc(p.description)}</p><strong class="detail-price">${money(p.price)}</strong><p class="stock">${stockText(p)}</p><button class="button full" data-add="${p.id}" ${!stock(p) ? "disabled" : ""}>Añadir al carrito ${icon("plus")}</button><a class="text-link" href="/productos/${p.slug}" data-link>Descubrir todos los detalles ${icon("right")}</a></div></div>`,
    "wide-modal",
  );
}
function inquiryForm(institution = false, product = null) {
  return `<form id="inquiry-form" class="form-grid">${field("Nombre completo", "name", state.user?.name || "", "text", 'required autocomplete="name"')}${field("Correo electrónico", "email", state.user?.email || "", "email", 'required autocomplete="email"')}${field("Teléfono", "phone", "", "tel", 'autocomplete="tel"')}${field(institution ? "Institución" : "Organización (opcional)", "organization", "", "text", institution ? "required" : "")}${select("¿Cómo podemos ayudarte?", "kind", institution ? ["Cotización institucional", "Implementación de laboratorio", "Compra por volumen", "Asesoría educativa"] : ["Consulta de producto", "Disponibilidad", "Soporte de pedido", "Consulta general"])}${textarea("Cuéntanos sobre tu proyecto", "message", product ? `Quiero consultar sobre ${product.name} (${product.sku}). ` : "", 'required maxlength="5000"')}<label class="honeypot" aria-hidden="true">Sitio web<input name="website" tabindex="-1" autocomplete="off"></label><div class="form-wide"><label class="checkbox"><input type="checkbox" required> Acepto la <a href="/privacidad" data-link>política de privacidad</a>.</label>${errorBox}<button class="button" type="submit">${institution ? "Solicitar asesoría" : "Enviar consulta"} ${icon("right")}</button></div></form>`;
}
function bindInquiry() {
  onForm("#inquiry-form", async (data, f) => {
    const r = await api("/inquiries", data);
    f.innerHTML = `<div class="success-state form-wide">${icon("check")}<h2>Tu idea ya está en buenas manos.</h2><p>Guardamos tu solicitud. Referencia: ${esc(r.id.slice(0, 8).toUpperCase())}.</p><p>Nuestro equipo podrá revisarla desde administración.</p></div>`;
  });
}
async function consult(pid) {
  const p = pid ? await loadProduct(pid) : null;
  if (state.settings.whatsapp) {
    window.open(
      "https://wa.me/" +
        state.settings.whatsapp +
        "?text=" +
        encodeURIComponent(
          p
            ? `Hola, quisiera consultar sobre ${p.name}, SKU ${p.sku}. ${location.origin}/productos/${p.slug}`
            : "Hola, me gustaría recibir asesoría para mi proyecto.",
        ),
      "_blank",
      "noopener,noreferrer",
    );
  } else {
    modal(
      `<span class="eyebrow">HABLEMOS DE TU PROYECTO</span><h2>${p ? esc(p.name) : "Estamos para ayudarte."}</h2>${inquiryForm(false, p)}`,
      "wide-modal",
    );
    bindInquiry();
  }
}
function institutions() {
  return `<section class="institution-hero wrap"><div><span class="eyebrow">SOLUCIONES PARA INSTITUCIONES</span><h1>Las grandes ideas<br>empiezan en el aula.</h1><p>${esc(state.settings.institutionalText)}</p><a class="button" href="#asesoria">Diseñemos tu laboratorio ${icon("right")}</a></div><img src="/assets/kit.webp" alt="Componentes de un kit de aprendizaje" width="700" height="700"></section><section class="three-cards wrap"><article>${icon("school")}<h3>Un laboratorio con propósito.</h3><p>Equipamiento alineado con tus objetivos de aprendizaje.</p></article><article>${icon("box")}<h3>Kits para cada etapa.</h3><p>Componentes para estudiantes, docentes y proyectos colaborativos.</p></article><article>${icon("chat")}<h3>Construimos contigo.</h3><p>Asesoría, cotizaciones por volumen y acompañamiento.</p></article></section><section class="contact-layout wrap section" id="asesoria"><div><span class="eyebrow">EL PRIMER PASO ES CONVERSAR</span><h2>Cuéntanos qué<br>quieres transformar.</h2><p>Escuelas, colegios, universidades, academias y espacios maker.</p></div><div class="form-panel">${inquiryForm(true)}</div></section>`;
}
function contact() {
  return `<section class="page-heading wrap"><span class="eyebrow">ESTAMOS CERCA</span><h1>Conectemos ideas.</h1><p>Un proyecto empieza con una buena conversación.</p></section><section class="contact-layout wrap"><div><h2>¿En qué podemos ayudarte?</h2><p>Consulta sobre componentes, disponibilidad, pedidos o tu próximo proyecto.</p>${state.settings.email ? `<a class="text-link" href="mailto:${esc(state.settings.email)}">${esc(state.settings.email)}</a>` : ""}${state.settings.address ? `<p>${esc(state.settings.address)}</p>` : ""}${state.settings.whatsapp ? `<button class="button secondary" data-consult="">${icon("chat")} Conversar por WhatsApp</button>` : ""}<div class="faq"><h3>Preguntas frecuentes</h3>${(state.settings.faq || []).map((f) => `<details><summary>${esc(f.q)}${icon("plus")}</summary><p>${esc(f.a)}</p></details>`).join("")}</div></div><div class="form-panel">${inquiryForm()}</div></section>`;
}
async function lab() {
  if (location.pathname === "/lab") {
    const a = await api("/articles");
    return `<section class="page-heading wrap"><span class="eyebrow">VIRTUS LAB</span><h1>Hecho para mentes curiosas.</h1><p>Guías, ideas y proyectos para aprender algo nuevo cada día.</p><div class="lab-grid">${a.length ? a.map(articleCard).join("") : empty("Estamos preparando nuevas ideas.", "Pronto encontrarás proyectos y guías para crear.")}</div></section>`;
  }
  const a = await api("/articles/" + location.pathname.split("/").pop());
  return `<article class="wrap article-detail"><a class="text-link" href="/lab" data-link>← Virtus Lab</a><span class="eyebrow">${esc(a.tag)}</span><h1>${esc(a.title)}</h1><p class="lead">${esc(a.excerpt)}</p>${a.image ? `<img class="article-cover" src="${esc(a.image)}" alt="">` : ""}<div class="article-body">${a.body
    .split("\n\n")
    .map((p) => `<p>${esc(p).replaceAll("\n", "<br>")}</p>`)
    .join(
      "",
    )}</div>${a.products.length ? `<section class="section"><div class="section-heading"><h2>Las piezas de este proyecto.</h2><button class="button small" id="add-project">Añadir componentes ${icon("plus")}</button></div><div class="product-grid">${a.products.map(card).join("")}</div></section>` : ""}</article>`;
}
function loginPage(admin = false) {
  return `<section class="auth-page wrap"><div><span class="eyebrow">${admin ? "ADMINISTRACIÓN VIRTUS" : "TU ESPACIO PARA CREAR"}</span><h1>${admin ? "Todo conectado." : "Tus proyectos,\nen un solo lugar.".replace("\n", "<br>")}</h1><p>${admin ? "Ingresa con una cuenta autorizada para gestionar tu tienda." : "Guarda tus favoritos, sigue tus pedidos y encuentra los recursos de tus productos."}</p></div><div class="form-panel"><div class="auth-tabs"><button class="active" data-auth-tab="login">Iniciar sesión</button>${admin ? "" : '<button data-auth-tab="register">Crear cuenta</button>'}</div><form id="auth-form" data-mode="login"><div id="register-name" hidden>${field("Nombre completo", "name", "", "text", 'autocomplete="name"')}</div>${field("Correo electrónico", "email", "", "email", 'required autocomplete="email"')}${field("Contraseña", "password", "", "password", 'required minlength="12" maxlength="128" autocomplete="current-password"')}<p class="small muted" id="password-help">Mínimo 12 caracteres.</p>${errorBox}<button class="button full" type="submit">Entrar ${icon("right")}</button><p class="small">Al crear tu cuenta aceptas la <a href="/privacidad" data-link>política de privacidad</a>.</p></form></div></section>`;
}
function bindLogin() {
  $$("[data-auth-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        $$("[data-auth-tab]").forEach((t) =>
          t.classList.toggle("active", t === b),
        );
        $("#auth-form").dataset.mode = b.dataset.authTab;
        $("#register-name").hidden = b.dataset.authTab === "login";
        $("#register-name input").required = b.dataset.authTab === "register";
        $("#auth-form [type=submit]").textContent =
          b.dataset.authTab === "login" ? "Entrar" : "Crear mi cuenta";
      }),
  );
  onForm("#auth-form", async (data) => {
    state.user = await api("/auth/" + $("#auth-form").dataset.mode, data);
    const account = await api("/me");
    for (const pid of state.favorites)
      await api("/favorites/" + pid, {}, "PUT").catch(() => {});
    state.favorites = [...new Set([...state.favorites, ...account.favorites])];
    persist();
    header();
    await render();
  });
}
async function account() {
  if (!state.user) return loginPage();
  const me = await api("/me");
  return `<section class="wrap account-page page-heading"><div class="section-heading"><div><span class="eyebrow">TU ESPACIO VIRTUS</span><h1>Hola, ${esc(state.user.name.split(" ")[0])}.</h1><p>Todo listo para tu próxima idea.</p></div><button class="button secondary" id="logout">${icon("logout")} Cerrar sesión</button></div><div class="account-layout"><nav class="account-nav"><a href="#mis-pedidos">${icon("bag")} Mis pedidos</a><a href="#mi-perfil">${icon("user")} Mi perfil</a><a href="#mis-direcciones">${icon("box")} Direcciones</a><a href="/favoritos" data-link>${icon("heart")} Favoritos</a><a href="#mis-recursos">${icon("book")} Descargas y recursos</a><a href="/contacto" data-link>${icon("chat")} Soporte</a>${state.user.role !== "customer" ? '<a href="/admin" data-link>Administrar tienda →</a>' : ""}</nav><div><section class="account-block" id="mis-pedidos"><h2>Mis pedidos</h2>${me.orders.length ? me.orders.map((o) => `<details class="order-card"><summary><span><strong>${esc(o.number)}</strong><small>${date(o.created_at)} ${o.demo ? "· Demo" : ""}</small></span><span class="badge">${esc(o.status)}</span><strong>${money(o.total)}</strong>${icon("chevron")}</summary><div class="order-body">${o.items.map((i) => `<p>${esc(i.name)} × ${i.quantity}<strong>${money(i.price * i.quantity)}</strong></p>`).join("")}<p>Entrega: ${o.delivery === "pickup" ? "Retiro" : "Envío"} · Pago: ${o.payment_method === "transfer" ? "Transferencia" : "Al retirar"}</p><ol>${o.history.map((h) => `<li>${esc(h.status)} · ${date(h.created_at)}</li>`).join("")}</ol><p class="small muted">Este resumen no es una factura electrónica. Solicita tu comprobante al equipo de soporte.</p>${o.has_invoice ? `<button class="text-link" data-invoice="${o.id}">${icon("download")} Descargar factura PDF</button>` : ""}<button class="text-link" data-order-download="${o.id}">${icon("download")} Descargar resumen</button></div></details>`).join("") : empty("Tu primera idea está por llegar.", "Tus pedidos aparecerán aquí después de comprar.")}</section><section class="account-block" id="mi-perfil"><h2>Mi perfil</h2><form id="profile-form" class="form-grid">${field("Nombre", "name", me.user.name, "text", "required")}${field("Teléfono", "phone", me.user.phone || "", "tel")}<div>${errorBox}<button class="button small" type="submit">Guardar cambios</button></div></form><details><summary>Cambiar contraseña ${icon("plus")}</summary><form id="password-form">${field("Contraseña actual", "current", "", "password", 'required autocomplete="current-password"')}${field("Nueva contraseña", "password", "", "password", 'required minlength="12" maxlength="128" autocomplete="new-password"')}${errorBox}<button class="button small" type="submit">Actualizar contraseña</button></form></details></section><section class="account-block" id="mis-direcciones"><h2>Mis direcciones</h2>${me.addresses.map((a) => `<div class="address-card"><div><strong>${esc(a.label)}</strong><p>${esc(a.data.address)} · ${esc(a.data.city)}, ${esc(a.data.province)}</p></div><button class="icon-button" data-address-delete="${a.id}" aria-label="Eliminar dirección">${icon("trash")}</button></div>`).join("")}<details><summary>Añadir una dirección ${icon("plus")}</summary><form id="address-form" class="form-grid">${field("Nombre de la dirección", "label", "", "text", 'required placeholder="Casa, trabajo…"')}${field("Dirección", "address", "", "text", "required")}${field("Ciudad", "city", "", "text", "required")}${field("Provincia", "province", "", "text", "required")}<div>${errorBox}<button class="button small" type="submit">Guardar dirección</button></div></form></details></section><section class="account-block" id="mis-recursos"><h2>Tus productos y su documentación.</h2><div class="resource-list">${
    [
      ...new Map(
        me.orders
          .filter((o) => o.status !== "Cancelado")
          .flatMap((o) => o.items)
          .map((i) => [i.product_id, i]),
      ).values(),
    ]
      .map(
        (i) =>
          `<button data-resource-product="${i.product_id}">${icon("book")} ${esc(i.name)} ${icon("right")}</button>`,
      )
      .join("") || "<p>Los recursos de tus productos aparecerán aquí.</p>"
  }</div></section></div></div></section>`;
}
const provinces = [
  "Azuay",
  "Bolívar",
  "Cañar",
  "Carchi",
  "Chimborazo",
  "Cotopaxi",
  "El Oro",
  "Esmeraldas",
  "Galápagos",
  "Guayas",
  "Imbabura",
  "Loja",
  "Los Ríos",
  "Manabí",
  "Morona Santiago",
  "Napo",
  "Orellana",
  "Pastaza",
  "Pichincha",
  "Santa Elena",
  "Santo Domingo de los Tsáchilas",
  "Sucumbíos",
  "Tungurahua",
  "Zamora Chinchipe",
];
async function checkout() {
  if (!state.cart.length)
    return `<div class="wrap section">${empty("Aún no hay piezas en tu carrito.", "Encuentra el inicio de tu próximo proyecto.")}</div>`;
  const rows = await cartRows(),
    s = state.settings;
  let addresses = [];
  if (state.user) addresses = (await api("/me")).addresses;
  return `<section class="wrap checkout-page"><div class="page-heading"><a href="/productos" class="text-link" data-link>← Seguir explorando</a><span class="eyebrow">UN PASO MÁS CERCA DE CREAR</span><h1>Hagamos realidad esa idea.</h1></div><form id="checkout-form" class="checkout-layout"><div><section class="form-panel"><h2><span class="step">01</span> Tus datos</h2><div class="form-grid">${field("Nombre completo", "name", state.user?.name || "", "text", 'required autocomplete="name"')}${field("Correo electrónico", "email", state.user?.email || "", "email", `required autocomplete="email" ${state.user ? "readonly" : ""}`)}${field("Teléfono", "phone", state.user?.phone || "", "tel", 'required autocomplete="tel" pattern="[+0-9 ()-]{7,30}"')}${field("Identificación (opcional)", "document", "", "text", 'maxlength="30"')}</div></section><section class="form-panel"><h2><span class="step">02</span> ¿Dónde lo recibes?</h2><div class="delivery-options">${s.pickupEnabled ? '<label><input type="radio" name="delivery" value="pickup" checked> Retiro en tienda</label>' : ""}${s.shippingEnabled ? `<label><input type="radio" name="delivery" value="shipping" ${!s.pickupEnabled ? "checked" : ""}> Envío a domicilio</label>` : ""}</div>${s.address ? `<p class="small">Retiro: ${esc(s.address)}</p>` : '<p class="small muted">El equipo coordinará el punto de retiro contigo.</p>'}${addresses.length ? select("Usar una dirección guardada", "saved_address", [["", "Ingresar otra dirección"], ...addresses.map((a) => [a.id, a.label])]) : ""}<div class="form-grid">${select("Provincia", "province", [["", "Selecciona tu provincia"], ...provinces])}${field("Ciudad", "city", "", "text", 'required autocomplete="address-level2"')}${field("Dirección y referencia", "address", "", "text", 'autocomplete="street-address"')}</div></section><section class="form-panel"><h2><span class="step">03</span> Método de pago</h2><div id="payment-options"></div><p class="small muted">Las pasarelas online aún no están habilitadas.</p></section><label class="checkbox"><input type="checkbox" name="accepted" required> He leído las <a href="/condiciones" data-link>condiciones</a> y la <a href="/privacidad" data-link>política de privacidad</a>.</label>${errorBox}</div><aside class="checkout-summary form-panel"><h2>Tu próximo proyecto.</h2>${rows.map((r) => `<div class="summary-item"><img src="${esc(r.p ? img(r.p) : "/assets/favicon.svg")}" alt=""><div><strong>${esc(r.name)}</strong><small>Cantidad: ${r.quantity}</small></div><b>${money(r.price * r.quantity)}</b></div>`).join("")}<div class="coupon-input"><input name="coupon" placeholder="¿Tienes un cupón?" aria-label="Código de descuento"><button class="text-link" id="apply-coupon" type="button">Aplicar</button></div><div id="quote-summary" aria-live="polite"><p>Calculando tu pedido…</p></div>${s.demo ? '<p class="notice">Estás en modo demostración. Este pedido no genera un cobro ni un envío real.</p>' : ""}<button class="button full" type="submit">Confirmar pedido ${icon("right")}</button><span class="checkout-security">${icon("shield")} Tus datos se procesan de forma privada</span></aside></form></section>`;
}
async function bindCheckout() {
  const f = $("#checkout-form");
  if (!f) return;
  const s = state.settings;
  let idempotency = crypto.randomUUID();
  let quoteSequence = 0;
  const recalc = async () => {
    const n = ++quoteSequence,
      data = formData(f),
      shipping = data.delivery === "shipping";
    f.elements.address.required = shipping;
    f.elements.province.required = true;
    const current = f.elements.payment_method?.value;
    $("#payment-options").innerHTML =
      `${!shipping && s.pickupEnabled ? `<label class="payment-option"><input type="radio" name="payment_method" value="pickup" ${current !== "transfer" ? "checked" : ""}> Pagar al retirar</label>` : ""}${s.transferEnabled ? `<label class="payment-option"><input type="radio" name="payment_method" value="transfer" ${shipping || current === "transfer" ? "checked" : ""}> Transferencia bancaria</label><p class="small pre-line">${esc(s.bankInstructions)}</p>` : ""}${shipping && !s.transferEnabled ? '<p class="notice">No hay un método de pago configurado para envíos. Puedes elegir retiro o consultar al equipo.</p>' : ""}`;
    try {
      const q = await api("/quote", {
        items: state.cart,
        coupon: data.coupon,
        delivery: data.delivery,
      });
      if (n !== quoteSequence) return;
      $("#quote-summary").innerHTML =
        `<div class="total-line"><span>Productos</span><span>${money(q.subtotal)}</span></div>${q.discount ? `<div class="total-line"><span>Descuento</span><span>−${money(q.discount)}</span></div>` : ""}<div class="total-line"><span>${shipping ? "Envío" : "Retiro"}</span><span>${q.shipping ? money(q.shipping) : "Sin costo"}</span></div><div class="total-line grand-total"><strong>Total USD</strong><strong>${money(q.total)}</strong></div>`;
      $(".form-error", f).textContent = "";
    } catch (e) {
      $(".form-error", f).textContent = e.message;
      $("#quote-summary").textContent =
        "Revisa tu carrito o cupón para continuar.";
    }
  };
  $$("[name=delivery]", f).forEach((r) => (r.onchange = recalc));
  $("#apply-coupon").onclick = recalc;
  if (f.elements.saved_address) {
    const addresses = (await api("/me")).addresses;
    f.elements.saved_address.onchange = () => {
      const a = addresses.find((a) => a.id === f.elements.saved_address.value);
      if (a)
        for (const k of ["address", "city", "province"])
          f.elements[k].value = a.data[k];
    };
  }
  await recalc();
  onForm(f, async (data) => {
    const o = await api("/orders", {
      items: state.cart,
      customer: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        document: data.document,
        city: data.city,
        province: data.province,
        address: data.address,
      },
      delivery: data.delivery,
      payment_method: data.payment_method,
      coupon: data.coupon,
      accepted: !!data.accepted,
      idempotency,
    });
    state.cart = [];
    persist();
    $("#main").innerHTML =
      `<section class="confirmation wrap">${icon("check")}<span class="eyebrow">${o.demo ? "PEDIDO DE DEMOSTRACIÓN" : "PEDIDO RECIBIDO"}</span><h1>Tu idea ya está en marcha.</h1><p>Pedido <strong>${esc(o.number)}</strong></p><p>Estado: ${esc(o.status)} · Total ${money(o.total)}</p><p>${o.payment_method === "transfer" ? esc(s.bankInstructions) : "Nuestro equipo coordinará contigo el retiro y el pago."}</p><button class="button" id="download-confirmation">Descargar resumen ${icon("download")}</button><a class="text-link" data-link href="/productos">Seguir creando ${icon("right")}</a></section>`;
    $("#download-confirmation").onclick = () => downloadOrder(o);
    window.scrollTo(0, 0);
  });
}
function downloadOrder(o) {
  const text = `VIRTUS ELECTRÓNICA\nRESUMEN DE PEDIDO — NO ES FACTURA\n${o.demo ? "DEMOSTRACIÓN\n" : ""}${o.number}\n${o.customer.name}\nEstado: ${o.status}\n\n${o.items.map((i) => `${i.name} (${i.sku}) × ${i.quantity}: ${money(i.price * i.quantity)}`).join("\n")}\nProductos: ${money(o.subtotal)}\nDescuento: ${money(o.discount)}\nEntrega: ${money(o.shipping)}\nTotal: ${money(o.total)}\n`;
  const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = o.number + ".txt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
let renderId = 0;
async function render() {
  const n = ++renderId,
    path = location.pathname;
  $("#mobile-nav")?.setAttribute("hidden", "");
  $("[data-menu]")?.setAttribute("aria-expanded", "false");
  $("#main").innerHTML =
    '<div class="loading"><span class="spinner"></span><p>Conectando ideas…</p></div>';
  try {
    let content;
    if (path === "/") content = await home();
    else if (
      path === "/productos" ||
      path.startsWith("/categoria/") ||
      path === "/kits"
    )
      content = await catalog();
    else if (path.startsWith("/productos/")) content = await productPage();
    else if (path === "/favoritos") content = await savedPage();
    else if (path === "/comparar") content = await savedPage(true);
    else if (path === "/instituciones") content = institutions();
    else if (path === "/contacto") content = contact();
    else if (path.startsWith("/lab")) content = await lab();
    else if (path === "/cuenta") content = await account();
    else if (path === "/checkout") content = await checkout();
    else if (path === "/admin") {
      if (!state.user) content = loginPage(true);
      else {
        const { renderAdmin } = await import("./admin.js");
        content = await renderAdmin(state, {
          navigate,
          card,
          remember,
          refresh: async () => {
            Object.assign(state, await api("/bootstrap"));
            header();
            footer();
          },
        });
      }
    } else if (path === "/privacidad" || path === "/condiciones") {
      const text =
        path === "/privacidad" ? state.settings.privacy : state.settings.legal;
      content = `<section class="wrap legal page-heading"><h1>${path === "/privacidad" ? "Privacidad" : "Condiciones de compra"}</h1><p class="pre-line">${esc(text || "La tienda se encuentra en preparación. Antes de habilitar operaciones comerciales, el administrador debe publicar aquí las condiciones y la política aplicables. En demostración, utiliza únicamente datos de prueba.")}</p></section>`;
    } else
      content = `<section class="wrap section">${empty("Esta conexión no existe.", "La página que buscas no está aquí. Volvamos a explorar.", "/", "Volver al inicio")}</section>`;
    if (n !== renderId) return;
    $("#main").innerHTML = content || "";
    document.title =
      ($("h1")?.innerText.replaceAll("\n", " ") || "Tecnología para crear") +
      " | VIRTUS Electrónica";
    document.querySelector("link[rel=canonical]").href =
      location.origin + location.pathname;
    bindPage();
  } catch (e) {
    if (n !== renderId) return;
    $("#main").innerHTML =
      `<div class="wrap section">${empty("No pudimos conectar esta vez.", esc(e.message), "/", "Volver al inicio")}</div>`;
  }
}
function bindPage() {
  bindShowroom(showroomProducts);
  bindInquiry();
  bindLogin();
  if ($("#filters")) {
    onForm("#filters", (data) => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(data))
        if (v)
          params.set(
            k,
            ["min", "max"].includes(k) ? Math.round(Number(v) * 100) : v,
          );
      if (location.pathname === "/kits") params.set("kits", "1");
      return navigate("/productos?" + params);
    });
    $("#sort").onchange = (e) => {
      const p = new URLSearchParams(location.search);
      p.set("sort", e.target.value);
      p.delete("page");
      navigate(location.pathname + "?" + p);
    };
    $(".filter-toggle").onclick = () => $(".filters").classList.toggle("open");
    $$("[data-page]").forEach(
      (b) =>
        (b.onclick = () => {
          const p = new URLSearchParams(location.search);
          p.set("page", b.dataset.page);
          navigate(location.pathname + "?" + p);
        }),
    );
  }
  const purchase = $("#purchase-form");
  if (purchase) {
    onForm(purchase, async (data) =>
      addToCart(
        purchase.dataset.product,
        Number(data.quantity),
        data.variant_id || null,
      ),
    );
    $("#buy-now").onclick = async () => {
      try {
        if (!purchase.reportValidity()) return;
        const d = formData(purchase);
        await addToCart(
          purchase.dataset.product,
          Number(d.quantity),
          d.variant_id || null,
          false,
        );
        navigate("/checkout");
      } catch (e) {
        toast(e.message);
      }
    };
    if (purchase.elements.variant_id)
      purchase.elements.variant_id.onchange = () => {
        const p = state.products.get(purchase.dataset.product),
          v = p.variants.find(
            (v) => v.id === purchase.elements.variant_id.value,
          );
        $("#variant-price").textContent = money(v.price);
        $("#variant-stock").textContent = v.stock
          ? `${v.stock} unidades disponibles`
          : "Agotado";
        purchase.elements.quantity.max = v.stock;
        purchase.elements.quantity.value = 1;
        $("[type=submit]", purchase).disabled = !v.stock;
        $("#buy-now").disabled = !v.stock;
      };
    $$("[data-image]").forEach(
      (b) =>
        (b.onclick = () => {
          $("#main-product-image").src = b.dataset.image;
          $$("[data-image]").forEach((t) =>
            t.classList.toggle("active", t === b),
          );
        }),
    );
  }
  if ($("#logout"))
    $("#logout").onclick = async () => {
      await api("/auth/logout", {});
      state.user = null;
      state.favorites = [];
      persist();
      header();
      render();
    };
  onForm("#profile-form", async (data) => {
    await api("/me", data, "PATCH");
    state.user.name = data.name;
    state.user.phone = data.phone;
    toast("Perfil actualizado.");
  });
  onForm("#password-form", async (data, f) => {
    await api("/auth/password", data);
    f.reset();
    toast("Contraseña actualizada. Las demás sesiones se cerraron.");
  });
  onForm("#address-form", async (data) => {
    await api("/addresses", data);
    render();
  });
  $$("[data-address-delete]").forEach(
    (b) =>
      (b.onclick = async () => {
        await api("/addresses/" + b.dataset.addressDelete, {}, "DELETE");
        render();
      }),
  );
  $$("[data-resource-product]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          const p = await loadProduct(b.dataset.resourceProduct);
          await navigate("/productos/" + p.slug);
          $("#documentacion")?.scrollIntoView();
        } catch (e) {
          toast(e.message);
        }
      }),
  );
  $$("[data-order-download]").forEach(
    (b) =>
      (b.onclick = async () =>
        downloadOrder(await api("/orders/" + b.dataset.orderDownload))),
  );
  if ($("#add-project"))
    $("#add-project").onclick = async () => {
      try {
        const a = await api("/articles/" + location.pathname.split("/").pop());
        for (const p of a.products) {
          remember(p);
          if (p.variants.length)
            throw new Error(
              "Selecciona las variantes desde cada ficha antes de añadir este proyecto.",
            );
          const existing = state.cart.find((c) => c.product_id === p.id);
          if ((existing?.quantity || 0) + 1 > stock(p))
            throw new Error(`Stock insuficiente: ${p.name}`);
        }
        for (const p of a.products) await addToCart(p.id, 1, null, false);
        cartDrawer();
      } catch (e) {
        toast(e.message);
      }
    };
  bindCheckout();
  if (location.pathname === "/admin" && state.user)
    import("./admin.js").then((m) => m.bindAdmin());
}
document.addEventListener("click", async (e) => {
  const a = e.target.closest("a[data-link]");
  if (a && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    e.preventDefault();
    navigate(a.getAttribute("href"));
    return;
  }
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  try {
    if (b.hasAttribute("data-invoice"))
      await downloadInvoice(b.dataset.invoice);
    else if (b.hasAttribute("data-search")) searchDialog();
    else if (b.hasAttribute("data-cart")) await cartDrawer();
    else if (b.hasAttribute("data-menu")) {
      const open = $("#mobile-nav").hidden;
      $("#mobile-nav").hidden = !open;
      b.setAttribute("aria-expanded", open);
    } else if (b.hasAttribute("data-add")) await addToCart(b.dataset.add);
    else if (b.hasAttribute("data-favorite"))
      await favorite(b.dataset.favorite);
    else if (b.hasAttribute("data-quick")) await quickView(b.dataset.quick);
    else if (b.hasAttribute("data-compare")) compare(b.dataset.compare);
    else if (b.hasAttribute("data-consult")) await consult(b.dataset.consult);
    else if (b.hasAttribute("data-close")) closeModal();
    else if (b.hasAttribute("data-zoom"))
      modal(
        `<img class="zoom-image" src="${esc($("#main-product-image").src)}" alt="Imagen ampliada">`,
        "zoom-modal",
      );
  } catch (err) {
    toast(err.message);
  }
});
window.addEventListener("popstate", () => {
  closeModal();
  render();
});
async function init() {
  try {
    Object.assign(state, await api("/bootstrap"));
    if (state.user) {
      const me = await api("/me");
      state.favorites = me.favorites;
    }
    header();
    footer();
    await render();
  } catch (e) {
    $("#main").innerHTML =
      `<div class="wrap section">${empty("Estamos reconectando.", "No se pudo cargar la tienda. Comprueba que el servidor esté iniciado.", "/", "Reintentar")}</div>`;
  }
}
init();
