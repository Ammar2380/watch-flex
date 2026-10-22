# WATCHFLEX (++watchflex)

React + Vite + TypeScript + Tailwind CSS v4 + Motion + Lucide. Migrated from the approved single-file MVP; palette, layout and copy are unchanged.

## Run
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
npm run preview
```

## Structure
`src/data/products.ts` (12 products, typed) · `src/config.ts` (currency, order URL, footer links) · `src/services/orderService.ts` (only backend integration point) · `src/hooks/` (`useLocalStorage`, `useDialog`) · `src/components/` (Intro, Sections = Header/Hero/Banner/Footer, ProductCatalog, QuickView, BagDrawer, CheckoutForm, WishButton).

## Order service contract
Set `VITE_ORDER_API_URL` (see `.env.example`). The app POSTs JSON:
`{ customer:{name,phone,city,address,notes}, items:[{id,name,qty,unitPrice}], subtotal, currency, paymentMethod:"COD" }`.
An order counts as placed **only** if the service answers 2xx with `{ "reference": "<string>" }`. Any other outcome keeps the bag and tells the customer the order was not placed. With no URL set, checkout is labelled **demo** and submits nothing. The service must allow CORS from the storefront origin and re-validate prices server-side.

## Needs owner confirmation before real orders
1. **Currency.** Prices show `$` (USD) but the business sells Cash on Delivery in Pakistan. Prices were not converted; edit `currency` in `src/config.ts` and prices in `products.ts`.
2. **Order backend or notification channel** (API, WhatsApp, email, spreadsheet) and its URL. No WhatsApp number or credentials were invented.
3. **Product claims carried over from the MVP, unverified:** "aerospace-grade stainless steel with sapphire crystal glass" (shown on all timepieces), "limited ++watchflex collection", "WATERPROOF 50M" (Aero Grid Steel), "Delivery: 3-5 Days". Edit `COPY` in `products.ts`.
4. **Placeholder subtitles** that look unfinished: `; time* (off)`, `++`, `SI Hello`.
5. **Images** are Unsplash placeholders, not photos of the real products. Products 5 and 12 use the same image.
6. **Footer links** (Privacy, Shipping & Returns, socials, etc.) have no destinations, so they render as plain text. Add URLs in `links` in `src/config.ts` and they become links.
7. Delivery charges, return policy and city coverage are not stated anywhere and are not shown.
