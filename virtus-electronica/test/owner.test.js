import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb, one } from "../src/db.js";
import { createApp } from "../src/server.js";
import { passwordMatches } from "../src/security.js";

test("owner setup needs a secret, is atomic, closes after one owner, and permits normal login", async () => {
  const db = openDb(":memory:"),
    key = "test-only-setup-secret-".repeat(3),
    origin = "http://localhost:3199";
  const server = createApp(db, { origin, setupKey: key });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const request = async (path, body, requestOrigin = origin) => {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        Origin: requestOrigin,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get("set-cookie"),
    };
  };
  try {
    const b = {
      name: "Dueño QA",
      email: "owner@example.test",
      password: "Strong-Local-Test-123",
      setup_key: key,
    };
    assert.deepEqual((await request("/api/auth/owner-setup")).data, {
      available: true,
      enabled: true,
    });
    assert.equal(
      (await request("/api/auth/owner-setup", { ...b, setup_key: "wrong" }))
        .status,
      403,
    );
    assert.equal(
      (await request("/api/auth/owner-setup", b, "http://untrusted.test"))
        .status,
      403,
    );
    const attempts = await Promise.all([
      request("/api/auth/owner-setup", b),
      request("/api/auth/owner-setup", { ...b, email: "second@example.test" }),
    ]);
    assert.deepEqual(attempts.map((r) => r.status).sort(), [200, 409]);
    assert.equal(
      one(db, "SELECT COUNT(*) n FROM users WHERE role='super_admin'").n,
      1,
    );
    const owner = one(db, "SELECT * FROM users WHERE role='super_admin'");
    assert.ok(await passwordMatches(b.password, owner.password));
    assert.equal(
      (await request("/api/auth/owner-setup")).data.available,
      false,
    );
    assert.equal((await request("/api/auth/owner-setup", b)).status, 409);
    const login = await request("/api/auth/login", {
      email: owner.email,
      password: b.password,
    });
    assert.equal(login.status, 200);
    assert.match(login.cookie, /HttpOnly/);
    const r = await fetch(base + "/api/management", {
      headers: { Cookie: login.cookie.split(";")[0] },
    });
    assert.equal(r.status, 200);
  } finally {
    await new Promise((r) => server.close(r));
    db.close();
  }
});
