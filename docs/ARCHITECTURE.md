# Awahouse MVP Architecture

## Product Scope

The blueprint defines six MVP features: verified agent profiles, verified listings with title badges, Ask Awa, escrow, Rent Monthly/Rent Score, and two-sided reviews. This implementation ships those flows in one local app with mocked external integrations and real persistence.

## Runtime

- `server.py`: Python stdlib HTTP server, JSON API, session management, security headers, and static file serving.
- `schema.sql`: SQLite relational model with foreign keys and check constraints.
- `static/`: responsive SPA for desktop and mobile marketplace use.
- `data/awahouse.db`: runtime SQLite database created on first run.

## Database Boundaries

- `users`: tenant, agent, landlord, and admin identities.
- `agents`: verified profile data, LASRERA/SCUML references, association, reputation.
- `listings`: marketplace inventory, title status, escrow/rent-monthly eligibility, source.
- `listing_amenities`: searchable listing trust and comfort tags.
- `watchlists`: tenant saved-listing state.
- `enquiries`: CRM lead capture from listing and Ask Awa workflows.
- `escrow_transactions`: escrow state, amount and 3% fee in kobo, idempotency key, Paystack reference placeholder.
- `verification_requests`: NIN, LASRERA, SCUML, title, and landlord-direct review queue.
- `reviews`: NIN-linked, transaction-gated review records.
- `rent_monthly_plans`: recurring rent state and Rent Score movement.
- `audit_events`: append-only operational trace for sensitive actions.

## External Integration Ports

The MVP deliberately keeps external systems as replaceable boundaries:

- Paystack escrow: replace `create_escrow` reference generation with Paystack transaction initialization and webhook idempotency.
- NIN/BVN/liveness: replace manual `verification_requests` approval with approved provider callbacks.
- LASRERA/SCUML/title: replace pending manual checks with registry integrations when available.
- Ask Awa WhatsApp: replace `/api/ask-awa` form calls with WhatsApp Business webhook events.
- OAuth: replace demo role sessions with Google OAuth/OpenID Connect.

## Production Upgrade Path

For production, move from local SQLite to PostgreSQL with row-level access rules, use managed object storage for documents/photos, add a job queue for webhooks and verification checks, place the app behind TLS, rotate `AWAHOUSE_SECRET`, and integrate a real identity provider.

