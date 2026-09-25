import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync, cpSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { root } from "./db.js";

export function backupDatabase(source, destination) {
  if (!existsSync(source))
    throw new Error("No existe una base de datos para respaldar.");
  mkdirSync(destination, { recursive: true });
  const db = new DatabaseSync(source, { readOnly: true });
  try {
    db.prepare("VACUUM INTO ?").run(resolve(destination, "store.sqlite"));
  } finally {
    db.close();
  }
  const uploads = resolve(dirname(source), "uploads");
  if (existsSync(uploads))
    cpSync(uploads, resolve(destination, "uploads"), {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
  writeFileSync(
    resolve(destination, "LEEME.txt"),
    "Respaldo de VIRTUS. Contiene usuarios y datos financieros privados.\nGuárdalo en un lugar protegido. Para restaurar, detén el servidor, conserva una copia de los datos actuales y restaura store.sqlite y uploads en la ruta DB_PATH configurada.\nLas credenciales de entorno no se incluyen.\n",
  );
  return destination;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const source = resolve(
    process.env.DB_PATH || resolve(root, "data/store.sqlite"),
  );
  try {
    console.log(
      "Respaldo creado: " +
        backupDatabase(
          source,
          resolve(process.env.BACKUP_PATH || resolve(root, "backups"), stamp),
        ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
