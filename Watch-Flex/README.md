# Watch Flex PK

Watch Flex PK is a Next.js 16 App Router storefront with guest checkout, email verification, promo codes, order tracking, admin product/order management and WhatsApp contact.

## Local development

```bash
npm install
cp .env.example .env.local
# Set ADMIN_PASSWORD (16+ characters) and SECRET (32+ random characters). Supabase + SMTP are recommended for realistic testing.
# On Windows PowerShell, create SECRET with:
# $b = New-Object byte[] 32; $r = [Security.Cryptography.RandomNumberGenerator]::Create(); $r.GetBytes($b); [Convert]::ToBase64String($b); $r.Dispose()
npm run dev
```

For local-only development without Supabase, the app falls back to `data.json` (seeded from `data/seed-products.json`). This fallback is disabled on Vercel and in production. Email is never written to an `outbox.log` or falsely reported as sent: SMTP must actually deliver the verification message before checkout email verification can complete.

## Production services

### Supabase

1. Create a Supabase project.
2. **Back up the current database first.** In **SQL Editor**, run `supabase/migrations/202611040001_watchflex_core.sql`.
   - This migration is additive for the earlier Watch Flex table `public.products(id, data, created_at)`: it keeps the existing rows and JSONB payload, adds the typed columns required by product admin and secure checkout, backfills those columns, and installs a trigger to keep `data` synchronized.
   - Existing records that contain either `images: [...]` or a single `image: "https://..."` are preserved. Editing the `data` JSON in Supabase Table Editor continues to update the catalogue; saving a product in the website admin updates `data` too.
   - Do not delete/recreate `public.products` to apply this upgrade.
3. Copy the project URL and the new **Secret key** (`sb_secret_...`) from **Settings → API Keys** into `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. The legacy `SUPABASE_SERVICE_ROLE_KEY` JWT is also supported temporarily. Never prefix either server key with `NEXT_PUBLIC_`; Supabase secret keys bypass RLS and must remain server-side.
4. Set `SUPABASE_STORAGE_BUCKET=product-images` (or leave the default). The migration creates a public read bucket with a 4 MB limit and approved image MIME types. All uploads/deletes go through authenticated admin API routes.
5. Copy `.env.example` to `.env.local` and add the Supabase values. **Important for an existing project that already has products in `public.products(id, data)`: do not run `npm run migrate:json`.** That importer is only for a separate legacy local `data.json` source and may refuse to merge into an already-populated database. Your existing Supabase products are upgraded in place by step 2; confirm they appear on `/` after restarting the app.
6. For a new, empty Supabase database only, use `npm run migrate:json` to import a local catalogue. The script makes a timestamped backup before importing an existing `data.json`; if there is none, it imports the four starter products and the welcome promo. The original JSON is not deleted. Verify product/order/promo counts in Supabase before going live.

The importer copies both existing HTTPS product images and legacy relative image files found under `public/` into the permanent bucket (default `product-images`). If you override `SUPABASE_STORAGE_BUCKET`, create that public bucket first with the same 4 MB limit and allowed MIME types. Missing local files stop the import with an explicit message so you can copy them into `public/` or re-upload via Admin. It refuses to merge into a populated products/orders/customers database unless you deliberately pass `--force` after taking a target backup.

The migration enables RLS on every commerce table and grants application data operations only to Supabase's elevated server role (Supabase Secret key / legacy service-role JWT). Hashed, database-backed request limits protect admin login and order tracking across Vercel instances. The public storefront reads products through a server-side API connection; browser clients never receive the service key. Orders are created with a PostgreSQL RPC transaction that locks inventory/promo rows, calculates prices and delivery charges on the server, applies stock/promo changes atomically, and enforces an idempotency key.

### Transactional email

Recommended low-cost setup: create a Brevo account, authenticate your sending domain (or verify a sender address), then open **Settings → SMTP & API → SMTP**. Copy the SMTP login to `SMTP_USER` and generate/copy an SMTP key (not the API key) to `SMTP_PASS`. Set `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, and `MAIL_FROM` to the verified sender. Set `ADMIN_EMAIL` to receive new-order alerts. Any other authenticated SMTP provider is also supported. Verification codes expire after 10 minutes, are stored only as keyed hashes, and have send and attempt limits. Order/status email errors do not erase a successfully placed order; the customer confirmation page reports when its email could not be sent. Use **Admin → Store settings → Test connections** to verify SMTP authentication and connection.

### Business contact and delivery

Set `NEXT_PUBLIC_WHATSAPP_NUMBER` to the business WhatsApp number in international digits (for example `923...`, without `+`). The storefront contact links and post-order prefilled WhatsApp handoff use this value. Delivery fee is configurable in **Admin → Store settings** and is calculated again in the database when an order is created. Courier name and tracking number are managed on the order details screen. Status changes attempt a customer email notification.

### Payments

Cash on Delivery is the only enabled payment method. Orders are saved with `payment_status=pending`; admins can mark COD as collected in order details. No online payment provider or merchant account is currently integrated in this source archive, so no online payment is simulated or exposed. To add online payments later, the business must first open and obtain approval for a merchant account with a supported Pakistan payment provider and supply its API credentials/webhook configuration.

## Vercel deployment

Import the repository into Vercel as a standard Next.js project (no custom build command required; `npm run build` is supported). Configure all production variables in **Project → Settings → Environment Variables** for Production and Preview as appropriate:

- `ADMIN_PASSWORD`
- `SECRET` (at least 32 random characters)
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
- `ADMIN_EMAIL` (recommended)
- `NEXT_PUBLIC_WHATSAPP_NUMBER`
- `SUPABASE_STORAGE_BUCKET` (optional; defaults to `product-images`)

Do not set `DATA_FILE` on Vercel. Production fails closed when Supabase URL/service-role credentials are absent; there is no filesystem database fallback. The admin panel is at `/admin`. After setting variables, deploy a preview, test checkout with a low-risk test item and confirm records/emails in the Supabase and SMTP dashboards before promoting to Production. No deployment or live data mutation is performed by the code changes in this archive.

## Important routes and files

- `/` catalogue and storefront; `/p/[id]` product details; `/bag`; `/checkout`
- `/shipping` delivery information and guest order tracking
- `/admin` protected admin panel
- `lib/db.js` server-side Supabase REST/RPC adapter (local JSON is development only; reads both the older `id,data` table shape and the upgraded typed product columns)
- `lib/mail.js` SMTP transport
- `lib/storage.js` permanent Supabase Storage adapter
- `supabase/migrations/` database schema, RLS and transactional RPCs
- `scripts/migrate-json-to-supabase.mjs` backup-first import utility

Guest checkout is intentional; customer account registration/login and password reset are not present in this source archive. Order history is retrieved by order reference plus checkout email, not a customer password account. Customers can retrieve an individual order using the order reference and checkout email, then print or save an itemized invoice from the tracker. No third-party CAPTCHA, analytics or error-monitoring account is included; database-backed login/tracking throttles, persistent email-code limits and a checkout honeypot are used without adding paid dependencies. Run `npm test` for the local data/auth-flow regression checks. A real production build still requires `npm install` to complete in an environment with npm registry access.
