# Watch Flex PK — project progress

Last updated: 2026-11-04

## Implemented in this working copy
- Replaced production JSON data access with a server-only Supabase REST/RPC adapter. Production/Vercel fails closed if Supabase is not configured; local JSON fallback is development-only.
- Added `supabase/migrations/202611040001_watchflex_core.sql`: products, promos, orders, customers, store settings, email verifications and database rate limits; RLS/private grants; transactional order creation, cancellation, stock/promo accounting and idempotency.
- Supports current Supabase `sb_secret_...` keys and legacy service-role JWTs. Secret values remain server-side. The storefront can read the earlier `public.products(id,data,created_at)` shape before migration; the additive SQL migration upgrades that table in place and keeps JSONB edits synchronized with normalized product columns.
- Added a backup-first `npm run migrate:json` importer. It imports existing JSON products/promos/orders/settings, transfers supported HTTPS/local images to Supabase Storage, preserves existing payment status, and refuses to merge over populated product/order/customer tables unless `--force` is supplied.
- Added persistent hashed email verification with 10-minute expiry, five attempts and five sends/hour per email; IP rate limits for verification send; database-backed admin login, order tracking and cancellation throttles.
- Integrated SMTP through Nodemailer for verification, order confirmation, admin new-order alert, status/dispatch and cancellation mail. SMTP failure is surfaced rather than falsely reported as delivered.
- Added permanent Supabase Storage uploads/deletes from admin, magic-byte validation, JPEG/PNG/WebP/AVIF support and a 4 MiB upload cap.
- Checkout now verifies email, validates address and quantities server-side, applies database prices/promos/delivery fee, creates COD orders transactionally, and uses an email-bound idempotency key. Customer tracking, pending cancellation and printable invoices are included.
- Added COD collection state, courier/tracking details, dispatch/tracking notifications, six-month revenue and top-product reports, low-stock alerts, CSV export, configurable delivery fee, admin service checks, and prefilled WhatsApp order details.
- Preserved the existing Watch Flex storefront structure and guest checkout. Upgraded to Next.js 16.4.5 / React 19.3.1, Node 22, and added security headers and secret/data ignores. Added responsive touch-target/form sizing, small-screen catalogue/checkout refinements, reduced-motion support and Lenis/GSAP ticker cleanup. Admin now handles failed initial data loads with a retry state, uses accessible order-status controls, and fixes the out-of-stock dashboard counter reference.

## Verification completed
- `npm test` — PASS after changes. Local commerce/auth/rate-limit regression suite and mocked Supabase adapter suite pass, including fallback reads from the legacy `id,data` product table and legacy single-image records.
- `node --check scripts/migrate-json-to-supabase.mjs` — PASS.
- Source parser validation — PASS across all 52 JavaScript/JSX/MJS files.
- Full `next build` — BLOCKED: dependencies are not installed (`next: not found`); npm registry access failed with `EAI_AGAIN registry.npmjs.org`. Re-run after `npm install` in a network-enabled environment.
- Live Supabase/Storage/SMTP connectivity and actual browser checkout/admin journey — NOT TESTED: no owner credentials were present. No production data was changed and no deployment was performed.

## Owner setup still required
1. Back up the existing Supabase project, run the additive SQL migration, and configure `SUPABASE_URL` + `SUPABASE_SECRET_KEY`. For the existing populated `public.products(id,data)` table, do not run `npm run migrate:json`; the migration preserves and upgrades those rows. Use the JSON importer only when moving a separate local `data.json` into an empty target database. The supplied archive contains no `data.json`.
2. Configure a verified SMTP sender and `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, and `ADMIN_EMAIL`.
3. Set strong `ADMIN_PASSWORD` (16+ characters), `SECRET` (32+ random characters), and the real `NEXT_PUBLIC_WHATSAPP_NUMBER` in local/Vercel environments.
4. Configure Vercel Production/Preview variables, deploy a Preview, test it with real services, then approve the Production deployment.
5. Online payment gateway integration remains intentionally disabled. COD works; enabling online payments requires a Pakistan merchant account, provider approval, credentials and webhook details, followed by provider-specific implementation.

Guest customer accounts/password reset, online payment gateway, third-party analytics and external error monitoring are not present in the source archive. Guest checkout was preserved; order tracking uses order reference + checkout email.
