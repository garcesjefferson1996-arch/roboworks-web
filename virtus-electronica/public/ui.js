export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [
  ...root.querySelectorAll(selector),
];
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const money = (c) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(
    (c || 0) / 100,
  );
export const date = (s) =>
  new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" }).format(
    new Date(s.replace(" ", "T") + "Z"),
  );
export async function api(path, body, method) {
  const response = await fetch("/api" + path, {
    method: method || (body ? "POST" : "GET"),
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "No se pudo completar la solicitud.");
  return result;
}
export const icons = {
  arrow: "M4 12h16m-6-6 6 6-6 6",
  right: "M4 12h16m-6-6 6 6-6 6",
  search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  bag: "M5 7h14l1 14H4L5 7Zm3 0V5a4 4 0 0 1 8 0v2",
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  user: "M20 21v-2a7 7 0 0 0-14 0v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "m6 6 12 12M6 18 18 6",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  check: "m5 12 4 4L19 6",
  truck:
    "M1 4h14v13H1zM15 8h4l4 5v4h-8M7 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0M21 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  shield: "m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4Zm-4 10 3 3 5-6",
  book: "M2 3h6a5 5 0 0 1 4 2 5 5 0 0 1 4-2h6v17h-6a5 5 0 0 0-4 2 5 5 0 0 0-4-2H2V3Zm10 2v17",
  chat: "M21 11a9 9 0 0 1-9 9 10 10 0 0 1-4-1l-6 2 2-6a9 9 0 1 1 17-4Z",
  chip: "M6 6h12v12H6zM9 9h6v6H9zM9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4",
  box: "m12 2 10 5v10l-10 5-10-5V7l10-5Zm0 10v10M2 7l10 5 10-5M7 4.5l10 5V15",
  sliders: "M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M1 10h6m2 2h6m2 4h6",
  compare: "M8 3v18m8-18v18M3 7h10m-2 10h10",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  logout: "M9 3H3v18h6m5-14 5 5-5 5M7 12h12",
  school: "m2 9 10-6 10 6-10 6L2 9Zm4 3v6c4 3 8 3 12 0v-6M22 9v8",
  bolt: "m13 2-9 12h7l-1 8 10-12h-7l1-8",
  chevron: "m9 5 7 7-7 7",
  edit: "m15 4 5 5M3 21l5-1L21 7a3 3 0 0 0-4-4L4 16l-1 5",
  chart: "M4 3v18h17M8 16l4-5 4 2 5-7",
};
export const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name] || icons.box}"/></svg>`;
export const logo = () =>
  '<span class="logo-image"><img src="/assets/virtus-original.png" alt="Virtus"></span><span class="logo-sub">ELECTRÓNICA</span>';
let toastTimer;
export function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 4000);
}
let lastFocus;
export function modal(content, cls = "") {
  const d = $("#dialog");
  lastFocus = document.activeElement;
  d.className = cls;
  d.innerHTML = `<button class="icon-button modal-close" aria-label="Cerrar">${icon("close")}</button>${content}`;
  if (!d.open) d.showModal();
  $(".modal-close", d).onclick = () => d.close();
  d.onclick = (e) => {
    if (e.target === d) {
      const r = d.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        d.close();
    }
  };
  d.onclose = () => {
    document.body.classList.remove("modal-open");
    lastFocus?.focus();
  };
  document.body.classList.add("modal-open");
  return d;
}
export function closeModal() {
  $("#dialog").close();
}
export const field = (label, name, value = "", type = "text", extra = "") =>
  `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
export const textarea = (label, name, value = "", extra = "") =>
  `<label class="field"><span>${label}</span><textarea name="${name}" ${extra}>${esc(value)}</textarea></label>`;
export const select = (label, name, options, value = "") =>
  `<label class="field"><span>${label}</span><select name="${name}">${options
    .map((o) => {
      const [val, text] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(val)}" ${val === value ? "selected" : ""}>${esc(text)}</option>`;
    })
    .join("")}</select></label>`;
export const formData = (f) => Object.fromEntries(new FormData(f));
export function onForm(selector, handler) {
  const f = typeof selector === "string" ? $(selector) : selector;
  if (!f) return;
  f.onsubmit = async (e) => {
    e.preventDefault();
    if (!f.reportValidity()) return;
    const button = $("[type=submit]", f),
      error = $(".form-error", f);
    if (error) error.textContent = "";
    if (button) button.disabled = true;
    try {
      await handler(formData(f), f);
    } catch (err) {
      if (error) error.textContent = err.message;
      else toast(err.message);
    } finally {
      if (button) button.disabled = false;
    }
  };
}
export const empty = (
  title,
  copy,
  link = "/productos",
  cta = "Explorar productos",
) =>
  `<div class="empty">${icon("box")}<h2>${title}</h2><p>${copy}</p><a class="button" href="${link}" data-link>${cta}${icon("right")}</a></div>`;
export const errorBox = '<p class="form-error" role="alert"></p>';
export async function filePayload(file) {
  if (!file || file.size > 10 * 1024 * 1024)
    throw new Error("Selecciona un archivo de hasta 10 MB.");
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
  return { name: file.name, data };
}
export async function downloadInvoice(oid) {
  const file = await api("/orders/" + oid + "/invoice"),
    bytes = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0)),
    url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })),
    a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
