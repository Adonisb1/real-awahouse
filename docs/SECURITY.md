# Security Checklist

## Implemented In This MVP

- Signed HttpOnly session cookies with `SameSite=Lax`.
- Per-session CSRF tokens required on every mutating endpoint.
- Strict security headers: CSP, frame denial, nosniff, referrer policy, permissions policy, and cross-origin policies.
- Static file serving is path-normalized and restricted to `static/`.
- JSON body limit of 64 KB.
- Per-IP in-memory rate limiting.
- SQLite parameterized queries only.
- Foreign keys and check constraints enabled.
- Amounts are stored as integer kobo, never floating point.
- NIN verification references are masked before storage.
- Sensitive actions write to `audit_events`.
- Client rendering uses DOM APIs or controlled templates from server-owned data; user submissions are validated and length-limited server-side.

## Production Requirements Before Public Launch

- Replace demo sessions with OAuth/OIDC and MFA for admin users.
- Set `AWAHOUSE_SECRET` to a long random value from a secret manager.
- Serve only over HTTPS and add the `Secure` cookie flag.
- Add durable rate limiting in Redis or an API gateway.
- Add file upload malware scanning and private object storage for title/NIN documents.
- Add webhook signature verification for Paystack and verification providers.
- Add admin authorization checks per action, not only per role.
- Add backups, encrypted database volumes, and retention policies aligned with NDPR.
- Run dependency, SAST, and DAST scans in CI when the project gains third-party packages.

