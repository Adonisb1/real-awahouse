import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";

const proc = spawn(process.execPath, ["server.mjs"], { stdio: ["ignore", "pipe", "pipe"] });
await new Promise((resolve) => setTimeout(resolve, 1200));

async function req(path, options = {}) {
  const res = await fetch(`http://127.0.0.1:8000${path}`, options);
  return { status: res.status, headers: res.headers, body: await res.text() };
}

try {
  let res = await req("/api/health");
  assert.equal(res.status, 200);
  assert.ok(res.headers.get("content-security-policy"));
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");

  res = await req("/api/bootstrap");
  assert.equal(res.status, 200);
  const cookie = res.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);

  res = await req("/api/enquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie.split(";", 1)[0] },
    body: JSON.stringify({ listingId: 1, message: "csrf probe" }),
  });
  assert.equal(res.status, 403);

  res = await req("/../server.mjs");
  assert.equal(res.status, 404);

  const source = readFileSync("server.mjs", "utf8");
  assert.ok(!/\.prepare\(`[^`]*\$\{(?!where\.join)/.test(source), "Unexpected SQL interpolation found");
  assert.ok(source.includes("Content-Security-Policy"));
  assert.ok(source.includes("timingSafeEqual"));

  const db = new DatabaseSync("data/awahouse.db");
  assert.equal(db.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
  const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((x) => x.name));
  for (const table of ["users", "listings", "escrow_transactions", "verification_requests", "audit_events"]) assert.ok(tables.has(table));
  db.close();
  console.log("Security checks passed");
} finally {
  proc.kill();
}

