import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { root, id } from "./db.js";
import { fail, str } from "./security.js";
export const uploadDirectory = () =>
  resolve(
    dirname(process.env.DB_PATH || resolve(root, "data/store.sqlite")),
    "uploads",
  );
export async function upload(body) {
  str(body.name, "Nombre de archivo", 200);
  const encoded = str(body.data, "Archivo", 14500000);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) fail(400, "Archivo inválido.");
  const buffer = Buffer.from(encoded, "base64");
  if (buffer.length < 8 || buffer.length > 10 * 1024 * 1024)
    fail(400, "El archivo debe pesar menos de 10 MB.");
  let extension;
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    extension = "png";
  else if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
    extension = "jpg";
  else if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  )
    extension = "webp";
  else if (buffer.toString("ascii", 0, 5) === "%PDF-") extension = "pdf";
  else
    fail(
      400,
      "Solo se admiten imágenes PNG, JPG, WebP y documentos PDF. Para videos, STL, código y software utiliza un enlace HTTPS.",
    );
  const filename = id() + "." + extension;
  await mkdir(uploadDirectory(), { recursive: true });
  await writeFile(resolve(uploadDirectory(), filename), buffer, { flag: "wx" });
  return {
    url: "/assets/uploads/" + filename,
    kind: extension === "pdf" ? "document" : "image",
    name: body.name,
  };
}
