import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  openDb,
  root,
  all,
  one,
  productQuery,
  product,
  settings,
} from "./db.js";
import { api } from "./api.js";
import { escape, fail } from "./security.js";
import { uploadDirectory } from "./uploads.js";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
};
export function createApp(db = openDb(), options = {}) {
  const buckets = new Map(),
    publicRoot = resolve(root, "public");
  const origin =
    options.origin ||
    process.env.APP_ORIGIN ||
    process.env.RENDER_EXTERNAL_URL ||
    `http://localhost:${process.env.PORT || 3100}`;
  if (process.env.NODE_ENV === "production" && !origin.startsWith("https://"))
    throw new Error("APP_ORIGIN debe usar HTTPS en producción.");
  return createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; media-src 'self' https:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    );
    if (process.env.NODE_ENV === "production")
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
    try {
      const url = new URL(req.url, origin),
        path = decodeURIComponent(url.pathname);
      if (path.startsWith("/api/")) {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        const sensitive =
            path.startsWith("/api/auth") || path === "/api/inquiries",
          key =
            (req.socket.remoteAddress || "local") +
            (sensitive ? ":sensitive" : ":api"),
          now = Date.now(),
          window = sensitive ? 900000 : 60000;
        if (buckets.size > 10000)
          for (const [k, v] of buckets) if (v.until < now) buckets.delete(k);
        let bucket = buckets.get(key);
        if (!bucket || bucket.until < now) {
          bucket = { n: 0, until: now + window };
          buckets.set(key, bucket);
        }
        if (++bucket.n > (sensitive ? 40 : 600)) {
          res.setHeader("Retry-After", Math.ceil((bucket.until - now) / 1000));
          fail(
            429,
            "Tantas solicitudes en poco tiempo. Intenta nuevamente más tarde.",
          );
        }
        let b = {};
        if (!["GET", "HEAD"].includes(req.method)) {
          if (req.headers.origin !== origin)
            fail(403, "Origen de solicitud no permitido.");
          if (
            !(req.headers["content-type"] || "").startsWith("application/json")
          )
            fail(415, "Se requiere JSON.");
          const maxBody =
            path === "/api/admin/uploads" ||
            /^\/api\/admin\/orders\/[^/]+\/invoice$/.test(path)
              ? 14500000
              : 200000;
          let raw = "",
            bytes = 0;
          for await (const chunk of req) {
            bytes += chunk.length;
            if (bytes > maxBody) fail(413, "Solicitud demasiado grande.");
            raw += chunk;
          }
          try {
            b = JSON.parse(raw || "{}");
          } catch {
            fail(400, "JSON inválido.");
          }
          if (!b || typeof b !== "object" || Array.isArray(b))
            fail(400, "Datos inválidos.");
        }
        const result = await api(db, req, res, url, b, {preview: options.preview === true, setupKey: options.setupKey ?? process.env.OWNER_SETUP_KEY});
        res.end(JSON.stringify(result));
        return;
      }
      if (!["GET", "HEAD"].includes(req.method))
        fail(405, "Método no permitido.");
      if (path === "/robots.txt") {
        res.setHeader("Content-Type", "text/plain");
        res.end(
          `User-agent: *\nDisallow: /admin\nDisallow: /cuenta\nDisallow: /checkout\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`,
        );
        return;
      }
      if (path === "/sitemap.xml") {
        res.setHeader("Content-Type", "application/xml");
        const paths = [
          "/",
          "/productos",
          "/kits",
          "/instituciones",
          "/lab",
          "/contacto",
          ...all(db, "SELECT slug FROM products WHERE active=1").map(
            (p) => "/productos/" + p.slug,
          ),
          ...all(db, "SELECT slug FROM categories WHERE active=1").map(
            (c) => "/categoria/" + c.slug,
          ),
          ...all(db, "SELECT slug FROM articles WHERE active=1").map(
            (a) => "/lab/" + a.slug,
          ),
        ];
        res.end(
          '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
            paths
              .map((p) => `<url><loc>${escape(origin + p)}</loc></url>`)
              .join("") +
            "</urlset>",
        );
        return;
      }
      if (extname(path)) {
        if (path.startsWith("/assets/uploads/")) {
          const name = path.slice("/assets/uploads/".length);
          if (!/^[a-f0-9-]+\.(png|jpg|webp|pdf)$/.test(name))
            fail(404, "Archivo no encontrado.");
          let bytes;
          try {
            bytes = await readFile(resolve(uploadDirectory(), name));
          } catch {
            fail(404, "Archivo no encontrado.");
          }
          res.setHeader("Content-Type", mime[extname(name)]);
          res.setHeader("Cache-Control", "public,max-age=86400");
          if (name.endsWith(".pdf"))
            res.setHeader(
              "Content-Disposition",
              'attachment; filename="recurso.pdf"',
            );
          res.end(req.method === "HEAD" ? undefined : bytes);
          return;
        }
        const file = resolve(publicRoot, "." + path);
        if (!file.startsWith(publicRoot + sep))
          fail(404, "Archivo no encontrado.");
        let info;
        try {
          info = await stat(file);
        } catch {
          fail(404, "Archivo no encontrado.");
        }
        if (!info.isFile()) fail(404, "Archivo no encontrado.");
        res.setHeader(
          "Content-Type",
          mime[extname(file)] || "application/octet-stream",
        );
        res.setHeader(
          "Cache-Control",
          path.startsWith("/assets/") ? "public,max-age=86400" : "no-cache",
        );
        res.end(req.method === "HEAD" ? undefined : await readFile(file));
        return;
      }
      const config = settings(db);
      let title = "VIRTUS Electrónica · Tecnología para crear",
        description =
          "Electrónica, robótica educativa y herramientas para makers en Ecuador. Explora componentes, kits y recursos técnicos.",
        schema = {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: config.businessName,
          url: origin,
        },
        ssr = "";
      const pm = path.match(/^\/productos\/([^/]+)$/);
      if (pm) {
        const p = product(
          db,
          one(db, productQuery + " WHERE p.slug=? AND p.active=1", pm[1]),
        );
        if (p) {
          title = (p.details.seoTitle || p.name) + " | VIRTUS Electrónica";
          description = p.details.seoDescription || p.description.slice(0, 170);
          schema = {
            "@context": "https://schema.org",
            "@type": "Product",
            name: p.name,
            sku: p.sku,
            description: p.description,
            image: p.images
              .filter((i) => i.kind === "image")
              .map((i) => new URL(i.url, origin).href),
            offers: {
              "@type": "Offer",
              price: (p.price / 100).toFixed(2),
              priceCurrency: "USD",
              availability:
                p.stock > 0
                  ? "https://schema.org/InStock"
                  : "https://schema.org/OutOfStock",
              url: origin + path,
            },
          };
          ssr = `<h1>${escape(p.name)}</h1><p>${escape(p.description)}</p><p>USD ${(p.price / 100).toFixed(2)}</p>`;
        } else res.statusCode = 404;
      } else if (
        !/^\/(?:|productos|categoria\/[^/]+|kits|instituciones|lab(?:\/[^/]+)?|contacto|favoritos|comparar|cuenta|checkout|admin|privacidad|condiciones)$/.test(
          path,
        )
      )
        res.statusCode = 404;
      let html = await readFile(resolve(publicRoot, "index.html"), "utf8");
      html = html
        .replaceAll("{{TITLE}}", escape(title))
        .replaceAll("{{DESCRIPTION}}", escape(description))
        .replaceAll("{{CANONICAL}}", escape(origin + path))
        .replace(
          "{{SCHEMA}}",
          JSON.stringify(schema).replaceAll("<", "\\u003c"),
        )
        .replace("{{SSR}}", ssr);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.end(req.method === "HEAD" ? undefined : html);
    } catch (error) {
      const status =
        error.status ||
        (String(error.code).startsWith("ERR_SQLITE") ? 409 : 500);
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      if (status === 500) console.error(error);
      res.end(
        JSON.stringify({
          error: error.status
            ? error.message
            : status === 409
              ? "El registro está duplicado o tiene datos relacionados. Revisa los campos."
              : "No pudimos completar la solicitud. Inténtalo nuevamente.",
        }),
      );
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const server = createApp();
  server.listen(
    Number(process.env.PORT || 3100),
    process.env.HOST || "127.0.0.1",
    () =>
      console.log(
        `VIRTUS Electrónica: ${process.env.APP_ORIGIN || "http://localhost:3100"}`,
      ),
  );
}
