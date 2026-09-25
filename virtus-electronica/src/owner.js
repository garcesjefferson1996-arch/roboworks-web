import { id, one, transaction } from "./db.js";
import { fail, str, email, password, passwordHash, hash } from "./security.js";

export function ownerSetupState(db, key) {
  return {
    available: !one(
      db,
      "SELECT id FROM users WHERE role='super_admin' LIMIT 1",
    ),
    enabled: typeof key === "string" && key.length >= 32,
  };
}
export async function createOwner(db, body, key) {
  const state = ownerSetupState(db, key);
  if (!state.available)
    fail(409, "El propietario ya está creado. Inicia sesión.");
  if (
    !state.enabled ||
    typeof body.setup_key !== "string" ||
    hash(body.setup_key) !== hash(key)
  )
    fail(403, "Clave de instalación incorrecta o configuración deshabilitada.");
  const name = str(body.name, "Nombre", 150),
    address = email(body.email);
  const secret = await passwordHash(password(body.password));
  return transaction(db, () => {
    if (!ownerSetupState(db, key).available)
      fail(409, "El propietario ya está creado.");
    if (one(db, "SELECT id FROM users WHERE email=?", address))
      fail(
        409,
        "Ya existe una cuenta con ese correo. Usa otro correo para el propietario.",
      );
    const uid = id();
    db.prepare(
      "INSERT INTO users(id,name,email,password,role) VALUES(?,?,?,?,?)",
    ).run(uid, name, address, secret, "super_admin");
    db.prepare(
      "INSERT INTO audit(id,actor_id,action,target) VALUES(?,?,?,?)",
    ).run(id(), uid, "owner.setup", uid);
    return { ok: true };
  });
}
