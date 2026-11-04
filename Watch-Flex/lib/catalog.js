import { pkr } from './site.js';

/** Turns raw product records into clean items. Records without id/name/positive price, or with a duplicate id, are skipped. */
export function normalize(raw) {
  const seen = new Set();
  const items = [];
  (Array.isArray(raw) ? raw : []).forEach((r, i) => {
    const id = String(r?.id || '').trim();
    const name = String(r?.name || '').trim();
    const price = Number(r?.price);
    if (!id || !name || !Number.isFinite(price) || price <= 0 || seen.has(id)) return;
    seen.add(id);
    const stockQuantity = r.stockQuantity === '' || r.stockQuantity == null ? null : Number(r.stockQuantity);
    const hasKnownQuantity = Number.isInteger(stockQuantity) && stockQuantity >= 0;
    const images = Array.isArray(r.images) && r.images.length ? r.images : (typeof r.image === 'string' && r.image ? [r.image] : []);
    const specs = Array.isArray(r.specs)
      ? r.specs
      : (typeof r.specs === 'string' ? r.specs.split(',').map((x) => x.trim()).filter(Boolean) : []);
    const p = {
      ...r,
      id,
      name,
      price: Math.round(price),
      brand: String(r.brand || ''),
      model: String(r.model || ''),
      category: String(r.category || 'Watches'),
      images: images.filter((x) => typeof x === 'string' && (/^https:\/\//i.test(x) || /^\/(?!\/)/.test(x))),
      specs: specs.map((x) => String(x).trim()).filter(Boolean),
      stockQuantity: hasKnownQuantity ? stockQuantity : null,
      stock: hasKnownQuantity ? (stockQuantity > 0 ? 'in' : 'out') : (['in', 'out', 'unknown'].includes(r.stock) ? r.stock : 'unknown'),
      featured: r.featured === true || r.featured === 'true' || r.featured === 1,
      isNew: r.isNew === true || r.isNew === 'true' || r.is_new === true || r.is_new === 'true' || r.is_new === 1,
      ord: i,
    };
    p.hay = [p.name, p.brand, p.model, p.category, ...p.specs].join(' ').toLowerCase();
    items.push(p);
  });
  return items;
}

/** Search + brand + price filter + sort */
export function viewOf(items, S) {
  const t = S.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let lo = Math.max(0, +S.min || 0);
  let hi = S.max === '' ? Infinity : Math.max(0, +S.max || 0);
  if (lo > hi) [lo, hi] = [hi, lo];
  const nm = (x, y) => x.name.localeCompare(y.name);
  const o = S.sort;
  return items
    .filter((p) => t.every((w) => p.hay.includes(w)) && (!S.brands.length || S.brands.includes(p.brand)) && (!(S.categories || []).length || S.categories.includes(p.category)) && p.price >= lo && p.price <= hi)
    .sort(
      o === 'low' ? (x, y) => x.price - y.price || nm(x, y)
      : o === 'high' ? (x, y) => y.price - x.price || nm(x, y)
      : o === 'name' ? nm
      : (x, y) => (!!y.featured - !!x.featured) || x.ord - y.ord
    );
}

/** Budget ranges come from the real price spread (up to 4 ranges, rounded to a sensible step) */
export function budgets(items) {
  const pr = items.map((p) => p.price).sort((a, b) => a - b);
  if (pr.length < 2 || pr[0] === pr[pr.length - 1]) return [];
  const mn = pr[0], mx = pr[pr.length - 1], k = Math.min(4, new Set(pr).size);
  const step = [500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000].find((s) => s >= (mx - mn) / (k * 3)) || 250000;
  const br = [...new Set([...Array(k - 1)].map((_, i) => Math.round(pr[Math.floor((pr.length * (i + 1)) / k)] / step) * step))].filter((b) => b > mn && b <= mx);
  if (!br.length) return [];
  const e = [0, ...br, Infinity];
  return e
    .slice(0, -1)
    .map((lo, i) => {
      const hi = e[i + 1] - 1;
      const n = pr.filter((x) => x >= lo && x <= hi).length;
      return {
        lo: lo ? String(lo) : '',
        hi: hi === Infinity ? '' : String(hi),
        n,
        label: !lo ? 'Under ' + pkr(e[1]) : hi === Infinity ? pkr(lo) + '+' : pkr(lo) + ' – ' + pkr(hi),
      };
    })
    .filter((b) => b.n);
}

export const subtotalOf = (rows) => rows.reduce((a, [p, q]) => a + p.price * q, 0);
