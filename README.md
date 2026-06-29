# Awahouse MVP

Awahouse is a trust-first Nigerian real estate marketplace MVP. This build turns the provided blueprint and mockups into a usable local webapp with a real SQLite database, responsive marketplace UI, landlord/agent workflows, verification queues, escrow initiation, reviews, watchlists, Rent Score, and Ask Awa search.

## Run Locally

```powershell
npm.cmd start
```

Open http://127.0.0.1:8000.

The app creates `data/awahouse.db` automatically and seeds demo records on first run.

## Demo Accounts

Use the role switcher in the app header. It creates a secure demo session for:

- Tenant: `tenant@awahouse.ng`
- Agent: `agent@awahouse.ng`
- Landlord: `landlord@awahouse.ng`
- Admin: `admin@awahouse.ng`

## What Is Included

- Verified listings with title status, escrow availability, agent/landlord source, reviews, and neighbourhood trust notes.
- Agent and landlord dashboards for leads, listings, escrow, reviews, and verification status.
- Property listing creation with server-side validation.
- NIN consent and masked verification records.
- LASRERA, SCUML, and title verification request workflow.
- Awahouse Escrow initiation with 3% fee, kobo integer storage, idempotency key support, and audit trail.
- Rent Monthly/Rent Score dashboard data.
- Ask Awa intent search endpoint that returns matching verified listings.
- Watchlist and enquiry capture.
- Security headers, CSRF protection, signed HttpOnly cookies, JSON body limits, rate limiting, input validation, parameterized SQL, and static file path hardening.

## Project Layout

```text
server.mjs                 Node HTTP app, SQLite API, sessions, and security
schema.sql                 SQLite schema
static/                    Responsive frontend
docs/ARCHITECTURE.md       Product and technical architecture
docs/SECURITY.md           Security model and checklist
tests/security.mjs         Lightweight security checks
data/                      Runtime SQLite database, ignored by git
```

Run checks:

```powershell
npm.cmd run test:security
```

If you prefer to bypass npm entirely:

```powershell
node .\server.mjs
```
