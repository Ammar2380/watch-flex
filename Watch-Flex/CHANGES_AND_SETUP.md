# Watch Flex PK — updated project handoff

This update is applied to the uploaded Watch Flex PK project structure. It does not replace the storefront with a different application.

## What changed

- Connected the existing product data layer to both the newer typed Supabase `products` schema and the earlier `public.products(id, data, created_at)` JSONB schema.
- Added an in-place, additive SQL upgrade for the earlier table. It preserves product rows and unknown JSON fields, converts legacy single `image` values into the `images` array, and keeps the old `data` JSONB value synchronized with the new typed columns.
- Kept product catalogue reads server-side. Supabase secret/service-role credentials are not sent to browser code.
- Added tests for legacy JSONB product reads, including single-image records and comma-separated specifications.
- Fixed the Admin dashboard's undefined out-of-stock counter reference.
- Added an initial-load error/retry state to Admin instead of leaving a blank screen when its data request fails.
- Improved order-status control accessibility, admin search labels, product action labels, and admin login labeling.
- Kept only permitted order status transitions visible in the admin selector.
- Hardened order CSV export against spreadsheet formula injection and added a UTF-8 BOM for spreadsheet compatibility.
- Improved mobile touch targets and form text sizing, including iOS input zoom prevention.
- Respected the visitor's reduced-motion setting and cleaned up the GSAP ticker on unmount.
- Updated the setup guide so a populated Supabase `id,data` product table is not accidentally re-imported from the sample JSON catalogue.

## Important: existing Supabase database with `public.products(id, data, created_at)`

Your screenshots show that this database already contains product rows in the `data` JSONB column. Use this path:

1. Back up/export the current Supabase `public.products` table before making schema changes.
2. Open Supabase → SQL Editor.
3. Run `supabase/migrations/202611040001_watchflex_core.sql` once. It adds the typed columns used by admin and transactional checkout, backfills them from the existing `data` values, and installs a trigger to keep both representations synchronized. It does not drop the existing product rows.
4. Put the Supabase project URL and server-side key in the local `.env.local` file:

   ```env
   SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   SUPABASE_SECRET_KEY=YOUR_SUPABASE_SECRET_KEY
   ADMIN_PASSWORD=YOUR_UNIQUE_PASSWORD_AT_LEAST_16_CHARACTERS
   SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
   ```

   `SUPABASE_SERVICE_ROLE_KEY` is also supported for older projects, but use the current secret key when possible. Never use a `NEXT_PUBLIC_` prefix for either server key and never paste secrets into chat or commit them to Git.

5. Install dependencies and start the project from its root folder:

   ```bash
   npm install
   npm test
   npm run dev
   ```

6. Visit `http://localhost:3000`. After the migration and environment values are set, the existing Supabase products should be displayed. Add or edit products through `/admin`; the JSONB `data` field will also be kept in sync for the old Table Editor workflow.

### Do not run the JSON importer against this already populated Supabase catalogue

Do **not** run `npm run migrate:json` for the existing database shown in your screenshots. That utility is for importing a separate local `data.json` catalogue into a new/empty target database. Your nine existing Supabase products are upgraded in place by the SQL migration above.

## Other setup needed for checkout

Email verification at checkout requires a working SMTP sender. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM`. `ADMIN_EMAIL` is recommended for new-order alerts. Without SMTP, the app deliberately does not claim that an email verification code was sent, so customers cannot complete email-verified checkout.

The optional Supabase Storage bucket is named `product-images` by default. Product image upload in Admin uses authenticated server routes; direct HTTPS image URLs can also be used.

## Verification and limits

- `npm test` passes the local commerce/auth tests and the mocked Supabase adapter tests, including old `id,data` product compatibility.
- JavaScript/JSX source parsing is checked in the build handoff process.
- A production `next build`, browser/device testing, and live Supabase/Storage/SMTP tests have not been completed here because this environment does not have the project dependencies or your private service credentials. Run `npm install` and `npm run build` locally after configuring your services.
- No live database records were modified by preparing this ZIP. Back up Supabase before applying its SQL migration.
