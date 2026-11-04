/* Client-safe constants for the storefront */
export const WA = String(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '923123802930').replace(/\D/g, '') || '923123802930';
export const IG = 'https://www.instagram.com/watchflex.pk/';
export const STEP = 16;
export const DEL = '3–\u20605'; // "3–5" with a word joiner so it never wraps in the middle
export const MARQUEE = ['Cash on delivery all over Pakistan', `Delivery in ${DEL} days`, 'Instagram @watchflex.pk'];
export const DECOR = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85';
/* customer reviews: add only real, permitted reviews as [name, city, text]. The section hides while empty. */
export const REV = [];

export const PHW =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><rect width="400" height="500" fill="#1a1d24"/><rect x="165" y="0" width="70" height="500" fill="#8f9ab3" opacity=".35"/><circle cx="200" cy="250" r="110" fill="#8f9ab3"/><circle cx="200" cy="250" r="96" fill="#0a1f44"/><path d="M200 250V192M200 250l36 20" stroke="#ebe5dd" stroke-width="5" stroke-linecap="round"/><circle cx="200" cy="250" r="6" fill="#ebe5dd"/></svg>'
  );

export const sm = (u) => u.replace('w=1800', 'w=900').replace('q=90', 'q=80');
export const pkr = (n) => 'PKR ' + Math.round(n).toLocaleString('en-US');
export const pHref = (id) => '/p/' + encodeURIComponent(id);
