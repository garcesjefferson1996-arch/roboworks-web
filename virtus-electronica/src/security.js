import { scrypt, randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const fail = (status, message) => {
  throw new HttpError(status, message);
};
export const hash = (s) => createHash("sha256").update(s).digest("hex");
export async function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await derive(password, salt, 64, { N: 32768, maxmem: 64 * 1024 * 1024 })).toString("hex")}`;
}
export async function passwordMatches(password, stored) {
  const [salt, key] = stored.split(":");
  const result = await derive(password, salt, 64, {
    N: 32768,
    maxmem: 64 * 1024 * 1024,
  });
  return timingSafeEqual(result, Buffer.from(key, "hex"));
}
export const token = () => randomBytes(32).toString("hex");
export function str(v, label, max = 200, required = true) {
  if (typeof v !== "string" || v.length > max || (required && !v.trim()))
    fail(400, `${label}: valor inválido.`);
  return v.trim();
}
export function integer(v, label, min = 0, max = 100000000) {
  if (!Number.isSafeInteger(v) || v < min || v > max)
    fail(400, `${label}: número inválido.`);
  return v;
}
export function email(v) {
  const s = str(v, "Correo", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
    fail(400, "Ingresa un correo válido.");
  return s;
}
export function password(v) {
  if (typeof v !== "string" || v.length < 12 || v.length > 128)
    fail(400, "La contraseña debe tener entre 12 y 128 caracteres.");
  return v;
}
export function safeUrl(v) {
  v = str(v, "URL", 2000, false);
  if (v && !/^https:\/\//.test(v) && !/^\/assets\/[\w./-]+$/.test(v))
    fail(400, "Utiliza una URL HTTPS o un archivo de /assets/.");
  return v;
}
export const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function authorized(user, permission) {
  return (
    !!user &&
    (user.permissions.includes("*") || user.permissions.includes(permission))
  );
}
