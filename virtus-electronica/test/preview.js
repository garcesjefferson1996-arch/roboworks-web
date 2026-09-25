// Isolated UI QA process. No test credentials or records reach the store database.
import { openDb, id } from "../src/db.js";
import { seed } from "../src/seed.js";
import { passwordHash } from "../src/security.js";
import { createApp } from "../src/server.js";
const db = openDb(":memory:");
seed(db);
db.prepare(
  "INSERT INTO users(id,name,email,password,role) VALUES(?,?,?,?,?)",
).run(
  id(),
  "Administrador QA",
  "qa@example.test",
  await passwordHash("Virtus-Local-QA-2026"),
  "super_admin",
);
const server = createApp(db, { origin: "http://localhost:3110", preview: true });
server.listen(3110, "127.0.0.1", () =>
  console.log("QA aislado: http://localhost:3110"),
);
