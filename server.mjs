import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { stat, readFile } from "node:fs/promises";
import { join, extname, normalize, resolve } from "node:path";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)));
const STATIC_DIR = resolve(ROOT, "static");
const DATA_DIR = resolve(ROOT, "data");
const DB_PATH = join(DATA_DIR, "awahouse.db");
const HOST = process.env.AWAHOUSE_HOST || "127.0.0.1";
const PORT = Number(process.env.AWAHOUSE_PORT || 8000);
const SECRET = process.env.AWAHOUSE_SECRET || "dev-secret-change-before-production";
const MAX_BODY = 64 * 1024;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 120;
const buckets = new Map();

const roleEmails = {
  tenant: "tenant@awahouse.ng",
  agent: "agent@awahouse.ng",
  landlord: "landlord@awahouse.ng",
  admin: "admin@awahouse.ng",
};

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
const database = new DatabaseSync(DB_PATH);
database.exec("PRAGMA foreign_keys = ON");
database.exec(readFileSync(join(ROOT, "schema.sql"), "utf8"));
seed();

function run(sql, ...params) {
  return database.prepare(sql).run(...params);
}
function get(sql, ...params) {
  return database.prepare(sql).get(...params);
}
function all(sql, ...params) {
  return database.prepare(sql).all(...params);
}
function tx(fn) {
  database.exec("BEGIN");
  try {
    const value = fn();
    database.exec("COMMIT");
    return value;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
function seed() {
  if (get("SELECT COUNT(*) count FROM users").count) return;
  tx(() => {
    const users = [
      ["Femi Adebayo", roleEmails.tenant, "tenant", "+2348010000001", 1, 710],
      ["Amina Johnson", roleEmails.agent, "agent", "+2348010000002", 1, 680],
      ["Tunde Balogun", roleEmails.landlord, "landlord", "+2348010000003", 1, 650],
      ["Awahouse Admin", roleEmails.admin, "admin", "+2348010000004", 1, 800],
    ];
    for (const user of users) run("INSERT INTO users(name,email,role,phone,nin_verified,rent_score) VALUES(?,?,?,?,?,?)", ...user);
    const agentUser = get("SELECT id FROM users WHERE email=?", roleEmails.agent).id;
    const landlord = get("SELECT id FROM users WHERE email=?", roleEmails.landlord).id;
    const tenant = get("SELECT id FROM users WHERE email=?", roleEmails.tenant).id;
    run(
      `INSERT INTO agents(user_id,display_name,lasrera_number,scuml_number,association,verification_status,neighbourhoods,deal_count,rating,bio)
       VALUES(?,?,?,?,?,?,?,?,?,?)`,
      agentUser,
      "Amina Johnson",
      "LASRERA/BRK/24/00831",
      "SCUML/RE/2024/55109",
      "AEAN",
      "verified",
      "Ikoyi, Victoria Island, Lekki Phase 1",
      43,
      4.9,
      "Verified Lagos rental specialist focused on title-checked homes and escrow-backed transactions."
    );
    const agent = get("SELECT id FROM agents WHERE user_id=?", agentUser).id;
    const listings = [
      [agentUser, agent, "The Obsidian Suite, Ikoyi", "Old Ikoyi, Lagos", "Eti-Osa", 18500000000, "sale", 4, 5, "Penthouse", "Sun-drenched luxury penthouse with registry-confirmed title, secure access, and escrow-supported closing.", "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80", "verified", "LS/LR/IKY/2025/10291", 1, 0, "agent", "published"],
      [agentUser, agent, "Lekki Phase 1 Serviced Apartment", "Admiralty Way, Lekki", "Eti-Osa", 850000000, "yearly", 3, 3, "Apartment", "Bright serviced apartment with verified agent, clean service charge history, and 48-hour escrow hold.", "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1400&q=80", "verified", "LS/LR/LEK/2025/44821", 1, 1, "agent", "published"],
      [landlord, null, "Yaba Direct Landlord Mini Flat", "Sabo, Yaba", "Lagos Mainland", 180000000, "yearly", 1, 1, "Mini flat", "Landlord-direct listing with title review pending, ideal for young professionals near the mainland tech corridor.", "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1400&q=80", "pending", "PENDING", 1, 1, "landlord", "published"],
      [agentUser, agent, "Victoria Island 2-Bed Waterfront", "Oniru, Victoria Island", "Eti-Osa", 620000000, "yearly", 2, 2, "Apartment", "Waterfront apartment with LASRERA-verified agent, service charge disclosure, and neighbourhood intelligence.", "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80", "verified", "LS/LR/VI/2025/90244", 1, 0, "agent", "published"],
    ];
    for (const listing of listings) run(
      `INSERT INTO listings(owner_user_id,agent_id,title,location,lga,price_kobo,rent_period,beds,baths,type,description,image_url,title_status,registry_reference,escrow_enabled,rent_monthly_enabled,source,status)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ...listing
    );
    const amenities = {
      1: ["Title verified", "Escrow", "24/7 power", "Secure parking"],
      2: ["Rent Monthly", "Escrow", "Serviced", "Verified agent"],
      3: ["Landlord direct", "Rent Monthly", "Near transit", "Pending title"],
      4: ["Waterfront", "Escrow", "Verified reviews", "Neighbourhood score"],
    };
    for (const [listingId, items] of Object.entries(amenities)) for (const item of items) run("INSERT INTO listing_amenities(listing_id,amenity) VALUES(?,?)", Number(listingId), item);
    run("INSERT INTO watchlists(user_id,listing_id) VALUES(?,?)", tenant, 2);
    run("INSERT INTO enquiries(listing_id,user_id,message,preferred_time,status) VALUES(?,?,?,?,?)", 2, tenant, "I would like a Saturday viewing and escrow breakdown.", "Saturday morning", "viewing_booked");
    run("INSERT INTO rent_monthly_plans(user_id,listing_id,monthly_amount_kobo,status,next_due_date) VALUES(?,?,?,?,date('now','+18 days'))", tenant, 2, 70833300, "active");
    run("INSERT INTO reviews(listing_id,reviewer_user_id,reviewee_user_id,rating,comment) VALUES(?,?,?,?,?)", 2, tenant, agentUser, 5, "Clear title documents, fast viewing, and no hidden inspection fee.");
    audit(null, "seeded", "system", null, { source: "blueprint-v6" });
  });
}

function sign(payload) {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}
function encodeSession(data) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
function decodeSession(value) {
  if (!value || !value.includes(".")) return null;
  const [payload, sig] = value.split(".");
  const expected = sign(payload);
  if (!safeEqual(sig, expected)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }));
}
function csrfToken() {
  return randomBytes(24).toString("base64url");
}
function json(res, status, data, headers = {}) {
  const body = Buffer.from(JSON.stringify(data));
  sendHeaders(res, status, "application/json; charset=utf-8", { "Content-Length": body.length, ...headers });
  res.end(body);
}
function sendHeaders(res, status, type, headers = {}) {
  res.writeHead(status, {
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' https://images.unsplash.com data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    ...headers,
  });
}
function rateLimited(req) {
  const ip = req.socket.remoteAddress || "local";
  const now = Date.now();
  const bucket = (buckets.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  bucket.push(now);
  buckets.set(ip, bucket);
  return bucket.length > RATE_LIMIT;
}
function currentUser(req) {
  const session = decodeSession(parseCookies(req).awahouse_session);
  if (!session?.user_id) return { session: null, user: null };
  return { session, user: userById(session.user_id) };
}
function userById(id) {
  return get("SELECT id,name,email,role,phone,nin_verified,rent_score FROM users WHERE id=?", id) || null;
}
function requireUser(req) {
  const context = currentUser(req);
  if (!context.user) {
    const err = new Error("Authentication required");
    err.status = 401;
    throw err;
  }
  return context;
}
function requireCsrf(req, session) {
  if (!session?.csrf || !safeEqual(req.headers["x-csrf-token"] || "", session.csrf)) {
    const err = new Error("Invalid CSRF token");
    err.status = 403;
    throw err;
  }
}
function bodyJson(req) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("Request body too large"), { status: 400 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolveBody({});
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("Invalid JSON"), { status: 400 }));
      }
    });
  });
}
function clean(value, limit, label) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!text) throw Object.assign(new Error(`${label} is required`), { status: 400 });
  if (text.length > limit) throw Object.assign(new Error(`${label} is too long`), { status: 400 });
  return text;
}
function moneyKobo(value) {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) throw Object.assign(new Error("Amount is required"), { status: 400 });
  return Number(digits) * 100;
}
function naira(kobo) {
  return `NGN ${Math.round(Number(kobo) / 100).toLocaleString("en-NG")}`;
}
function audit(actor, eventType, entityType, entityId = null, metadata = {}) {
  run("INSERT INTO audit_events(actor_user_id,event_type,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?)", actor, eventType, entityType, entityId, JSON.stringify(metadata));
}
function listingRow(row, user) {
  const amenities = all("SELECT amenity FROM listing_amenities WHERE listing_id=?", row.id).map((x) => x.amenity);
  const watched = user ? Boolean(get("SELECT 1 FROM watchlists WHERE user_id=? AND listing_id=?", user.id, row.id)) : false;
  return {
    id: row.id,
    title: row.title,
    location: row.location,
    lga: row.lga,
    priceKobo: row.price_kobo,
    price: naira(row.price_kobo),
    rentPeriod: row.rent_period,
    beds: row.beds,
    baths: row.baths,
    type: row.type,
    description: row.description,
    imageUrl: row.image_url,
    titleStatus: row.title_status,
    registryReference: row.registry_reference,
    escrowEnabled: Boolean(row.escrow_enabled),
    rentMonthlyEnabled: Boolean(row.rent_monthly_enabled),
    source: row.source,
    status: row.status,
    agentName: row.agent_name,
    agentRating: row.agent_rating,
    association: row.association,
    amenities,
    watched,
  };
}
function listings(user, params = new URLSearchParams()) {
  const where = ["l.status='published'"];
  const args = [];
  const query = (params.get("q") || "").trim();
  if (query) {
    where.push("(l.title LIKE ? OR l.location LIKE ? OR l.lga LIKE ? OR l.type LIKE ?)");
    args.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
  }
  if (params.get("verified")) where.push("l.title_status='verified'");
  const rows = all(
    `SELECT l.*, a.display_name agent_name, a.rating agent_rating, a.association
     FROM listings l LEFT JOIN agents a ON a.id=l.agent_id
     WHERE ${where.join(" AND ")}
     ORDER BY l.title_status='verified' DESC, l.created_at DESC`,
    ...args
  );
  return rows.map((row) => listingRow(row, user));
}
function dashboard(user) {
  return {
    listingCount: get("SELECT COUNT(*) count FROM listings WHERE owner_user_id=?", user.id).count,
    enquiries: all(
      `SELECT e.id,e.message,e.status,e.created_at,l.title listing_title,u.name lead_name
       FROM enquiries e JOIN listings l ON l.id=e.listing_id JOIN users u ON u.id=e.user_id
       WHERE l.owner_user_id=? OR ?='admin' ORDER BY e.created_at DESC LIMIT 8`,
      user.id,
      user.role
    ),
    escrows: all(
      `SELECT et.id,et.status,et.amount_kobo,et.fee_kobo,l.title listing_title
       FROM escrow_transactions et JOIN listings l ON l.id=et.listing_id
       WHERE et.tenant_user_id=? OR l.owner_user_id=? OR ?='admin' ORDER BY et.created_at DESC LIMIT 8`,
      user.id,
      user.id,
      user.role
    ),
    verifications: all(
      `SELECT id,kind,subject_reference,status,created_at FROM verification_requests
       WHERE user_id=? OR ?='admin' ORDER BY created_at DESC LIMIT 8`,
      user.id,
      user.role
    ),
    activeRentPlans: get("SELECT COUNT(*) count FROM rent_monthly_plans WHERE user_id=? AND status='active'", user.id).count,
    rentScore: user.rent_score,
  };
}
function bootstrap(req, res) {
  let { session, user } = currentUser(req);
  const headers = {};
  if (!user) {
    user = userById(get("SELECT id FROM users WHERE email=?", roleEmails.tenant).id);
    session = { user_id: user.id, csrf: csrfToken(), iat: Math.floor(Date.now() / 1000) };
    headers["Set-Cookie"] = `awahouse_session=${encodeSession(session)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`;
  }
  json(res, 200, { csrf: session.csrf, user, listings: listings(user), dashboard: dashboard(user) }, headers);
}
async function api(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") return json(res, 200, { ok: true, service: "awahouse-mvp" });
  if (req.method === "GET" && url.pathname === "/api/bootstrap") return bootstrap(req, res);
  const { session, user } = req.method === "GET" ? currentUser(req) : requireUser(req);
  if (req.method === "GET" && url.pathname === "/api/listings") return json(res, 200, { listings: listings(user, url.searchParams) });
  const detail = url.pathname.match(/^\/api\/listings\/(\d+)$/);
  if (req.method === "GET" && detail) {
    const item = listings(user).find((x) => x.id === Number(detail[1]));
    if (!item) return json(res, 404, { error: "Not found" });
    item.reviews = all(`SELECT r.rating,r.comment,r.created_at,u.name reviewer FROM reviews r JOIN users u ON u.id=r.reviewer_user_id WHERE r.listing_id=? ORDER BY r.created_at DESC`, item.id);
    return json(res, 200, { listing: item });
  }
  if (req.method === "GET" && url.pathname === "/api/dashboard") {
    if (!user) return json(res, 401, { error: "Authentication required" });
    return json(res, 200, { dashboard: dashboard(user) });
  }
  if (req.method !== "POST") return json(res, 404, { error: "Not found" });
  const body = await bodyJson(req);
  if (url.pathname === "/api/auth/demo") {
    const role = body.role;
    if (!roleEmails[role]) return json(res, 400, { error: "Unsupported role" });
    const userId = get("SELECT id FROM users WHERE email=?", roleEmails[role]).id;
    const nextSession = { user_id: userId, csrf: csrfToken(), iat: Math.floor(Date.now() / 1000) };
    audit(userId, "login_demo", "user", userId, { role });
    return json(res, 200, { ok: true, csrf: nextSession.csrf, user: userById(userId) }, { "Set-Cookie": `awahouse_session=${encodeSession(nextSession)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800` });
  }
  requireCsrf(req, session);
  if (url.pathname === "/api/watchlist") {
    const listingId = Number(body.listingId);
    const exists = get("SELECT 1 FROM watchlists WHERE user_id=? AND listing_id=?", user.id, listingId);
    if (exists) run("DELETE FROM watchlists WHERE user_id=? AND listing_id=?", user.id, listingId);
    else run("INSERT INTO watchlists(user_id,listing_id) VALUES(?,?)", user.id, listingId);
    audit(user.id, "watchlist_toggled", "listing", listingId, { watched: !exists });
    return json(res, 200, { ok: true, watched: !exists });
  }
  if (url.pathname === "/api/enquiries") {
    const listingId = Number(body.listingId);
    run("INSERT INTO enquiries(listing_id,user_id,message,preferred_time) VALUES(?,?,?,?)", listingId, user.id, clean(body.message, 500, "Message"), String(body.preferredTime || "").slice(0, 80));
    audit(user.id, "enquiry_created", "listing", listingId);
    return json(res, 200, { ok: true });
  }
  if (url.pathname === "/api/escrow/initiate") {
    const listingId = Number(body.listingId);
    const listing = get("SELECT owner_user_id,price_kobo,escrow_enabled FROM listings WHERE id=? AND status='published'", listingId);
    if (!listing?.escrow_enabled) return json(res, 400, { error: "Escrow is not available for this listing" });
    const amount = Number(body.amountKobo || listing.price_kobo);
    const fee = Math.floor(amount * 0.03);
    const key = clean(body.idempotencyKey || randomUUID(), 90, "Idempotency key");
    const result = run(
      `INSERT INTO escrow_transactions(listing_id,tenant_user_id,agent_user_id,amount_kobo,fee_kobo,status,idempotency_key,paystack_reference)
       VALUES(?,?,?,?,?,?,?,?)`,
      listingId,
      user.id,
      listing.owner_user_id,
      amount,
      fee,
      "awaiting_payment",
      key,
      `PSK_DEMO_${randomBytes(6).toString("hex").toUpperCase()}`
    );
    audit(user.id, "escrow_initiated", "escrow", Number(result.lastInsertRowid), { listingId, feeKobo: fee });
    return json(res, 200, { ok: true, escrowId: Number(result.lastInsertRowid), feeKobo: fee, status: "awaiting_payment" });
  }
  if (url.pathname === "/api/verification") {
    const allowed = new Set(["nin", "lasrera", "scuml", "title", "landlord_direct"]);
    if (!allowed.has(body.kind)) return json(res, 400, { error: "Invalid verification type" });
    let reference = clean(body.reference, 120, "Reference");
    if (body.kind === "nin") reference = `NIN-****${reference.slice(-4)}`;
    const result = run(
      "INSERT INTO verification_requests(user_id,listing_id,kind,subject_reference,status,consent_text) VALUES(?,?,?,?,?,?)",
      user.id,
      body.listingId || null,
      body.kind,
      reference,
      "pending",
      "User consents to Awahouse processing this verification data for trust and safety under NDPR principles."
    );
    audit(user.id, "verification_requested", "verification", Number(result.lastInsertRowid), { kind: body.kind });
    return json(res, 200, { ok: true, verificationId: Number(result.lastInsertRowid) });
  }
  if (url.pathname === "/api/reviews") {
    const listingId = Number(body.listingId);
    const listing = get("SELECT owner_user_id FROM listings WHERE id=?", listingId);
    if (!listing) return json(res, 404, { error: "Listing not found" });
    const rating = Math.max(1, Math.min(5, Number(body.rating || 5)));
    const result = run("INSERT INTO reviews(listing_id,reviewer_user_id,reviewee_user_id,rating,comment) VALUES(?,?,?,?,?)", listingId, user.id, listing.owner_user_id, rating, clean(body.comment, 500, "Review"));
    audit(user.id, "review_created", "review", Number(result.lastInsertRowid), { listingId });
    return json(res, 200, { ok: true });
  }
  if (url.pathname === "/api/ask-awa") {
    const query = clean(body.query, 220, "Query");
    const params = new URLSearchParams({ q: query, verified: "1" });
    const matches = listings(user, params).slice(0, 3);
    audit(user.id, "ask_awa_search", "lead", null, { query, matches: matches.length });
    return json(res, 200, { reply: `I found ${matches.length} verified option(s) that match your request.`, listings: matches });
  }
  if (url.pathname === "/api/listings") {
    if (!["agent", "landlord", "admin"].includes(user.role)) return json(res, 401, { error: "Only agents and landlords can list property" });
    const agent = get("SELECT id FROM agents WHERE user_id=?", user.id);
    const result = run(
      `INSERT INTO listings(owner_user_id,agent_id,title,location,lga,price_kobo,rent_period,beds,baths,type,description,image_url,title_status,registry_reference,escrow_enabled,rent_monthly_enabled,source,status)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      user.id,
      agent?.id || null,
      clean(body.title, 120, "Title"),
      clean(body.location, 120, "Location"),
      clean(body.lga, 80, "LGA"),
      moneyKobo(body.price),
      ["monthly", "yearly", "sale"].includes(body.rentPeriod) ? body.rentPeriod : "yearly",
      Math.max(0, Math.min(20, Number(body.beds || 0))),
      Math.max(0, Math.min(20, Number(body.baths || 0))),
      clean(body.type, 40, "Property type"),
      clean(body.description, 900, "Description"),
      "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1400&q=80",
      "pending",
      "PENDING",
      1,
      body.rentPeriod === "sale" ? 0 : 1,
      agent ? "agent" : "landlord",
      "pending_review"
    );
    const listingId = Number(result.lastInsertRowid);
    for (const amenity of (body.amenities || []).slice(0, 8)) run("INSERT OR IGNORE INTO listing_amenities(listing_id,amenity) VALUES(?,?)", listingId, clean(amenity, 40, "Amenity"));
    audit(user.id, "listing_created", "listing", listingId, { status: "pending_review" });
    return json(res, 200, { ok: true, listingId });
  }
  return json(res, 404, { error: "Not found" });
}
async function serveStatic(req, res, url) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const safe = normalize(decodeURIComponent(pathname).replace(/^\/+/, ""));
  if (safe.startsWith("..")) return json(res, 404, { error: "Not found" });
  const file = resolve(STATIC_DIR, safe);
  if (!file.startsWith(STATIC_DIR)) return json(res, 404, { error: "Not found" });
  try {
    const info = await stat(file);
    if (!info.isFile()) return json(res, 404, { error: "Not found" });
    const body = await readFile(file);
    const type = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".svg": "image/svg+xml" }[extname(file)] || "application/octet-stream";
    sendHeaders(res, 200, type, { "Content-Length": body.length, "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    json(res, 404, { error: "Not found" });
  }
}
const server = createServer(async (req, res) => {
  try {
    if (rateLimited(req)) return json(res, 429, { error: "Too many requests" });
    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    return await serveStatic(req, res, url);
  } catch (error) {
    if (error.code === "ERR_SQLITE_CONSTRAINT_UNIQUE") return json(res, 409, { error: "Duplicate or invalid request" });
    json(res, error.status || 500, { error: error.status ? error.message : "Server error" });
  }
});
server.listen(PORT, HOST, () => console.log(`Awahouse MVP running at http://${HOST}:${PORT}`));
