import { esc, money, icon } from "./ui.js";

export function showroom(products) {
  if (!products.length)
    return '<section class="wrap section"><h1>Tu próxima idea empieza aquí.</h1><a class="button" href="/productos" data-link>Explorar catálogo</a></section>';
  return `<section class="showroom" aria-label="Explorador de productos" aria-roledescription="carrusel" tabindex="0">
    <div class="showroom-heading"><div><span class="eyebrow">IMAGINA. CONECTA. CREA.</span><h1>Pequeñas piezas.<br><span>Grandes posibilidades.</span></h1></div><a class="showroom-catalog" href="/productos" data-link>Explorar catálogo ${icon("arrow")}</a></div>
    <div class="showroom-stage"><div class="showroom-track">${products
      .map((p, i) => {
        const available = p.status === "available";
        return `<article class="showroom-item ${i === 0 ? "is-active" : ""}" data-slide="${i}" aria-label="${i + 1} de ${products.length}: ${esc(p.name)}">
        <div class="showroom-panel"></div><div class="showroom-title"><span>${esc(p.category || "Electrónica")}</span><h2>${esc(p.name)}</h2></div>
        <button class="showroom-object" data-select="${i}" aria-label="Explorar ${esc(p.name)}" aria-pressed="${i === 0}"><span class="showroom-watermark" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><img src="${esc(p.images?.[0]?.url || "/assets/hero.webp")}" alt="${esc(p.name)}" draggable="false" ${i === 0 ? 'fetchpriority="high"' : ""}></button>
        <div class="showroom-buy"><div><small>Precio · USD</small><strong>${Number.isInteger(p.price) ? money(p.price) : "Consultar precio"}</strong></div><button class="showroom-add" data-add="${esc(p.id)}" aria-label="Añadir ${esc(p.name)} al carrito" ${available ? "" : "disabled"}>${icon("plus")}</button></div>
        <button class="showroom-discover" data-discover="${i}" aria-expanded="false" aria-controls="showroom-details">Descubrir ${icon("right")}</button>
      </article>`;
      })
      .join("")}</div>
    <aside class="showroom-details" id="showroom-details" hidden><button class="showroom-back" aria-label="Cerrar detalles">${icon("right")} Volver a explorar</button><div data-showroom-detail></div></aside></div>
    <div class="showroom-bottom"><div class="showroom-navigation"><button data-step="-1" aria-label="Producto anterior">${icon("right")}</button><span class="showroom-counter" aria-live="polite" aria-atomic="true">01 <span>/ ${String(products.length).padStart(2, "0")}</span></span><button data-step="1" aria-label="Producto siguiente">${icon("right")}</button></div><div class="showroom-dots" aria-label="Seleccionar producto">${products.map((p, i) => `<button data-select="${i}" class="${i === 0 ? "active" : ""}" aria-label="Mostrar ${esc(p.name)}" aria-pressed="${i === 0}"><span></span></button>`).join("")}</div><span class="showroom-hint">Desliza y encuentra tu próxima idea ${icon("arrow")}</span></div>
    <div class="showroom-paths"><a href="/kits" data-link><span>01 / APRENDE</span><strong>Tu primer proyecto ${icon("arrow")}</strong></a><a href="/productos" data-link><span>02 / CONSTRUYE</span><strong>Encuentra cada pieza ${icon("arrow")}</strong></a><a href="/instituciones" data-link><span>03 / COMPARTE</span><strong>Tecnología para el aula ${icon("arrow")}</strong></a></div>
  </section>`;
}

export function bindShowroom(products) {
  const root = document.querySelector(".showroom");
  if (!root || !products.length) return;
  let active = 0,
    start = null,
    dragged = false;
  const slides = [...root.querySelectorAll("[data-slide]")];
  const details = root.querySelector(".showroom-details");
  const close = () => {
    clearTimeout(hoverTimer);
    pinned = false;
    root.classList.remove("details-open");
    details.hidden = true;
    root
      .querySelectorAll("[data-discover]")
      .forEach((b) => b.setAttribute("aria-expanded", "false"));
  };
  let pinned = false;
  let hoverTimer;
  const openDetails = (focus = false) => {
    if (!root.isConnected) return;
    pinned = focus || pinned;
      const p = products[active];
      root.querySelector("[data-showroom-detail]").innerHTML =
        `<span class="eyebrow">CONOCE TU PRÓXIMA PIEZA</span><h2>${esc(p.name)}</h2><p>${esc(p.description)}</p><dl>${[
          ["Voltaje", p.details?.voltage],
          ["Nivel", p.details?.level],
          ["Tecnología", p.details?.technology],
        ]
          .filter(([, v]) => v)
          .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
          .join(
            "",
          )}</dl><a class="button" href="/productos/${esc(p.slug)}" data-link>Ver ficha completa ${icon("right")}</a>`;
      details.hidden = false;
      root.classList.add("details-open");
      slides[active].querySelector("[data-discover]").setAttribute("aria-expanded", "true");
    if (focus) details.querySelector("button").focus();
  };
  const select = (index) => {
    close();
    active = (index + products.length) % products.length;
    root.style.setProperty("--active", active);
    slides.forEach((slide, i) => {
      let offset = (i - active + products.length) % products.length;
      if (offset > Math.floor(products.length / 2)) offset -= products.length;
      slide.style.setProperty("--offset", offset);
      slide.classList.toggle("is-active", i === active);
      slide
        .querySelectorAll(".showroom-buy button, .showroom-discover")
        .forEach((b) => (b.tabIndex = i === active ? 0 : -1));
    });
    root.querySelectorAll("[data-select]").forEach((b) => {
      const chosen = Number(b.dataset.select) === active;
      b.setAttribute("aria-pressed", String(chosen));
      b.classList.toggle("active", chosen);
    });
    root.querySelector(".showroom-counter").innerHTML =
      `${String(active + 1).padStart(2, "0")} <span>/ ${String(products.length).padStart(2, "0")}</span>`;
  };
  root.addEventListener("click", (e) => {
    if (dragged) {
      e.preventDefault();
      e.stopPropagation();
      dragged = false;
      return;
    }
    const b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-select")) select(Number(b.dataset.select));
    if (b.hasAttribute("data-step")) select(active + Number(b.dataset.step));
    if (b.matches(".showroom-back")) {
      close();
      slides[active].querySelector("[data-discover]").focus();
    }
    if (b.hasAttribute("data-discover")) {
      openDetails(true);

    }
  });
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !details.hidden) {
      close();
      slides[active].querySelector("[data-discover]").focus();
    }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      select(active + (e.key === "ArrowRight" ? 1 : -1));
    }
  });
  const stage = root.querySelector(".showroom-stage");
  slides.forEach((slide, i) => {
    slide.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse" || !matchMedia("(hover: hover) and (min-width: 761px)").matches || i !== active || !details.hidden) return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => openDetails(), 220);
    });
    slide.addEventListener("pointerleave", () => clearTimeout(hoverTimer));
  });
  stage.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button:not(.showroom-object),a,.showroom-details"))
      return;
    start = { x: e.clientX, y: e.clientY };
    dragged = false;
  });
  stage.addEventListener("pointerup", (e) => {
    if (!start) return;
    const dx = e.clientX - start.x,
      dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      dragged = true;
      select(active + (dx < 0 ? 1 : -1));
    }
  });
  stage.addEventListener("pointercancel", () => {
    start = null;
  });
  stage.addEventListener("pointerleave", () => {
    start = null;
    clearTimeout(hoverTimer);
    if (!pinned && !details.contains(document.activeElement)) close();
  });
  select(0);
}
