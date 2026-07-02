import pg from "pg";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac, randomUUID } from "node:crypto";

const { Pool } = pg;
const root = dirname(dirname(fileURLToPath(import.meta.url)));
let pool;

export function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
      max: 4,
    });
  }
  return pool;
}

export async function query(text, params = []) {
  const result = await db().query(text, params);
  return result;
}

export async function migrate() {
  const sql = await readFile(join(root, "supabase", "migrations", "001_real_pilot_schema.sql"), "utf8");
  await query(sql);
}

export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.end(JSON.stringify(data));
}

export async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 128 * 1024) {
      const error = new Error("Request body too large");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function readRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export function clean(value, limit = 240, label = "Field") {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!text) {
    const error = new Error(`${label} is required`);
    error.status = 400;
    throw error;
  }
  if (text.length > limit) {
    const error = new Error(`${label} is too long`);
    error.status = 400;
    throw error;
  }
  return text;
}

export function moneyKobo(value) {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) {
    const error = new Error("Amount is required");
    error.status = 400;
    throw error;
  }
  return Number(digits) * 100;
}

export function adminEmails() {
  return new Set(String(process.env.ADMIN_EMAILS || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean));
}

export async function authUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const error = new Error("Supabase auth is not configured");
    error.status = 500;
    throw error;
  }
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;
  return response.json();
}

export async function requireUser(req) {
  const user = await authUser(req);
  if (!user?.id || !user?.email) {
    const error = new Error("Authentication required");
    error.status = 401;
    throw error;
  }
  return ensureProfile(user);
}

export async function ensureProfile(user, overrides = {}) {
  const email = String(user.email || overrides.email || "").toLowerCase();
  const admin = adminEmails().has(email);
  const requestedRole = overrides.role || user.user_metadata?.role || "tenant";
  const role = admin || !["tenant", "agent", "landlord", "admin"].includes(requestedRole) ? (admin ? "admin" : "tenant") : requestedRole;
  const fullName = overrides.full_name || user.user_metadata?.full_name || user.user_metadata?.name || email.split("@")[0];
  const result = await query(
    `insert into public.profiles (id, full_name, email, phone, role)
     values ($1, $2, $3, $4, $5)
     on conflict (id) do update set
       full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
       phone = coalesce(excluded.phone, public.profiles.phone),
       role = case when $6 then 'admin'::public.user_role else coalesce(nullif($7, '')::public.user_role, public.profiles.role) end
     returning *`,
    [user.id, fullName, email, overrides.phone || null, role, admin, role]
  );
  return result.rows[0];
}

export async function requireAdmin(req) {
  const profile = await requireUser(req);
  if (profile.role !== "admin") {
    const error = new Error("Admin access required");
    error.status = 403;
    throw error;
  }
  return profile;
}

export function hmacSha512(secret, body) {
  return createHmac("sha512", secret).update(body).digest("hex");
}

export function newReference(prefix = "AWA") {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 18).toUpperCase()}`;
}

export async function audit(adminId, action, entityType, entityId, metadata = {}) {
  await query(
    "insert into public.admin_actions (admin_id, action, entity_type, entity_id, metadata) values ($1, $2, $3, $4, $5)",
    [adminId || null, action, entityType, entityId || null, metadata]
  );
}

export function handleError(res, error) {
  console.error(error);
  send(res, error.status || 500, { error: error.status ? error.message : "Server error" });
}
