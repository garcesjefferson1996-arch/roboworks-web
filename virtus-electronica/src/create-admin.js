import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { openDb, id, one, transaction } from "./db.js";
import { passwordHash, password, email, str } from "./security.js";
const rl = createInterface({ input: stdin, output: stdout });
let db;
try {
  db = openDb();
  if (one(db, "SELECT id FROM users WHERE role='super_admin' LIMIT 1"))
    throw new Error(
      "El propietario ya está creado. Inicia sesión con tu cuenta existente.",
    );
  const name = str(await rl.question("Nombre del administrador: "), "Nombre");
  const address = email(await rl.question("Correo: "));
  console.log(
    "Introduce una contraseña de al menos 12 caracteres (entrada visible en esta terminal local).",
  );
  const secret = password(await rl.question("Contraseña: "));
  const encoded = await passwordHash(secret);
  transaction(db, () => {
    if (one(db, "SELECT id FROM users WHERE role='super_admin' LIMIT 1"))
      throw new Error("El propietario ya está creado.");
    db.prepare(
      "INSERT INTO users(id,name,email,password,role) VALUES(?,?,?,?,?)",
    ).run(id(), name, address, encoded, "super_admin");
  });
  console.log("Propietario creado. Inicia sesión en /gestion.html.");
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  db?.close();
  rl.close();
}
