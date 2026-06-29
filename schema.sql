PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('tenant','agent','landlord','admin')),
  phone TEXT,
  nin_verified INTEGER NOT NULL DEFAULT 0,
  rent_score INTEGER NOT NULL DEFAULT 620,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  lasrera_number TEXT,
  scuml_number TEXT,
  association TEXT,
  verification_status TEXT NOT NULL CHECK(verification_status IN ('verified','pending','rejected')),
  neighbourhoods TEXT NOT NULL,
  deal_count INTEGER NOT NULL DEFAULT 0,
  rating REAL NOT NULL DEFAULT 0,
  bio TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  location TEXT NOT NULL,
  lga TEXT NOT NULL,
  price_kobo INTEGER NOT NULL CHECK(price_kobo >= 0),
  rent_period TEXT NOT NULL CHECK(rent_period IN ('monthly','yearly','sale')),
  beds INTEGER NOT NULL CHECK(beds >= 0),
  baths INTEGER NOT NULL CHECK(baths >= 0),
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT NOT NULL,
  title_status TEXT NOT NULL CHECK(title_status IN ('verified','pending','disputed')),
  registry_reference TEXT,
  escrow_enabled INTEGER NOT NULL DEFAULT 1,
  rent_monthly_enabled INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL CHECK(source IN ('agent','landlord')),
  status TEXT NOT NULL CHECK(status IN ('draft','pending_review','published','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS listing_amenities (
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  amenity TEXT NOT NULL,
  PRIMARY KEY (listing_id, amenity)
);

CREATE TABLE IF NOT EXISTS watchlists (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  preferred_time TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','viewing_booked','closed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS escrow_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  tenant_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  amount_kobo INTEGER NOT NULL CHECK(amount_kobo >= 0),
  fee_kobo INTEGER NOT NULL CHECK(fee_kobo >= 0),
  status TEXT NOT NULL CHECK(status IN ('draft','awaiting_payment','held','release_requested','released','disputed','cancelled')),
  idempotency_key TEXT NOT NULL UNIQUE,
  paystack_reference TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS verification_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK(kind IN ('nin','lasrera','scuml','title','landlord_direct')),
  subject_reference TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),
  consent_text TEXT NOT NULL,
  reviewer_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reviewer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  transaction_gated INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rent_monthly_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  monthly_amount_kobo INTEGER NOT NULL CHECK(monthly_amount_kobo >= 0),
  score_delta INTEGER NOT NULL DEFAULT 10,
  status TEXT NOT NULL CHECK(status IN ('pending','active','missed_payment','completed')),
  next_due_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

