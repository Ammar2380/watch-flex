# Watch Flex PK (Next.js)

The same shop, now a Next.js (App Router) project: storefront, checkout with email verification, promo codes, orders, emails and the `/admin` panel.

## Run it

```bash
npm install
cp .env.example .env.local      # then edit it
npm run dev                     # http://localhost:3000   admin: http://localhost:3000/admin
# production:
npm run build && npm start
```

Needs Node 18.17+.

## Settings (`.env.local`)

| Variable | What it does |
|---|---|
| `ADMIN_PASSWORD` | Password for `/admin` (required, choose a strong one). If missing, a temporary one is printed in the console. |
| `SECRET` | Any long random text. Keeps admin and email-verification logins valid after a restart. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Your email provider (Gmail app password, Brevo, Zoho...). Without SMTP, emails are printed in the console and saved to `outbox.log`. |
| `ADMIN_EMAIL` | Optional. Gets an email for every new order. |
| `DATA_FILE` | Optional. Where the JSON database lives (default `./data.json`). |

## Where things are

```
app/(shop)/            storefront pages: /  /p/[id]  /bag  /checkout  /shipping  /privacy
app/admin/             admin panel (/admin)
app/api/               the same API as before (verify, promo, orders, admin/*)
components/            ShopProvider (cart, theme, smooth scroll, page transition), pages, header, footer
lib/                   db.js (JSON file), auth.js, mail.js, promo.js, catalog.js, site.js (phone, Instagram, texts)
data/seed-products.json  the 4 starter products, used only the first time (before data.json exists)
app/(shop)/globals.css   the storefront styles, unchanged from the old index.html
```

Change the WhatsApp number, Instagram link, marquee text and reviews in `lib/site.js`.
Products, orders and promo codes are edited in the admin panel, not in code.

## Hosting

Data is stored in `data.json`, so you need a host that keeps a Node server running with a disk that survives restarts (Render with a disk, Railway with a volume, a VPS). Back up `data.json`.
Vercel or other serverless hosts cannot keep a file, so they would need a hosted database first.

## What changed from the old version

- Pages are real URLs now (`/bag`, `/checkout`, `/p/<id>`) instead of `#hash` links. Old `#bag` / `#p-...` links redirect automatically.
- Each watch page has its own title and description for Google and sharing.
- GSAP and Lenis are installed from npm instead of loaded from a CDN.
- The store, the API and the admin panel are one project, started with one command.
