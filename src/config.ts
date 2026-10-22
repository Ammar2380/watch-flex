/** OWNER TO CONFIRM: the MVP showed "$" prices next to Pakistan-wide COD. Prices were NOT converted. */
export const currency = { code: 'USD', locale: 'en-US' };
export const money = (n: number) =>
  new Intl.NumberFormat(currency.locale, { style: 'currency', currency: currency.code }).format(n);

/** Empty = demo mode. Set VITE_ORDER_API_URL to connect a real order service. */
export const orderEndpoint = (import.meta.env.VITE_ORDER_API_URL as string | undefined) || '';

/** Footer link destinations, keyed by label. Empty = no real destination yet, so rendered as plain text. */
export const links: Record<string, string> = {};
