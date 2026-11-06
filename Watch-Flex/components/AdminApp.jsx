'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pkr } from '@/lib/site';
import './admin.css';

/* ───────────── constants & helpers ───────────── */
const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const FLOW = ['pending', 'confirmed', 'shipped', 'delivered'];
const TRANSITIONS = { pending: ['pending', 'confirmed', 'cancelled'], confirmed: ['confirmed', 'shipped', 'cancelled'], shipped: ['shipped', 'delivered'], delivered: ['delivered'], cancelled: ['cancelled'] };
const NEXT = { pending: ['confirmed', 'Confirm'], confirmed: ['shipped', 'Mark shipped'], shipped: ['delivered', 'Mark delivered'] };
const TABS = [['dash', 'Dashboard', 'dash'], ['orders', 'Orders', 'orders'], ['products', 'Products', 'watch'], ['promos', 'Promo codes', 'promo'], ['cust', 'Customers', 'cust'], ['site', 'Homepage', 'mq'], ['settings', 'Settings', 'cog']];
const TITLES = {
  dash: ['Dashboard', 'Orders, sales and stock at a glance'],
  orders: ['Orders', 'Track every order from pending to delivered'],
  products: ['Products', 'Manage watches, descriptions, prices and sales'],
  promos: ['Promo codes', 'Discount codes customers can use at checkout'],
  cust: ['Customers', 'Everyone who has ordered from you'],
  site: ['Homepage', 'Control the scrolling marquee on your store homepage'],
  settings: ['Settings', 'Delivery charge and service checks'],
};
const SIZES = [12, 24, 48];
const MAX_IMAGE = 4 * 1024 * 1024;
const DESC_MAX = 1200;
const SALE_CHIPS = [5, 10, 15, 20, 25, 30, 40, 50];
const MQ_MAX_ITEMS = 12;
const MQ_MAX_LEN = 120;
const MQ_SPEEDS = [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']];
const MQ_IDEAS = ['Cash on delivery across Pakistan', 'New arrivals every week', 'Order today, delivered to your door'];

/* Plain text glyphs instead of drawn graphics. \uFE0E forces text style (no coloured emoji). */
const GLYPHS = {
  dash: '◈', orders: '▣', watch: '◷', promo: '%', cust: '◉', mq: '»', cog: '✦', menu: '☰', plus: '+', arrow: '↗',
  refresh: '↻', download: '↓', logout: '↩\uFE0E', x: '✕', check: '✓', edit: '✎', alert: '!', wallet: '₨', truck: '⇢', percent: '%', up: '↑', down: '↓',
};
const Icon = ({ n, size = 18 }) => <span className="ax-i" style={{ fontSize: size }} aria-hidden="true">{GLYPHS[n] || '•'}</span>;

const when = (d) => { const x = new Date(d); return Number.isFinite(x.getTime()) ? x.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; };
const day = (d) => { const x = new Date(d); return Number.isFinite(x.getTime()) ? x.toLocaleDateString('en-GB', { dateStyle: 'medium' }) : '—'; };
const isPaid = (o) => o.payment_status === 'paid' || o.paymentStatus === 'paid';
const qtyOf = (p) => (p.stockQuantity === null || p.stockQuantity === undefined || p.stockQuantity === '' ? null : Number(p.stockQuantity));
const isLow = (p) => p.stock === 'out' || (qtyOf(p) !== null && qtyOf(p) <= 5);
const stockLabel = (p) => (p.stock === 'out' ? 'Out of stock' : qtyOf(p) !== null && qtyOf(p) <= 5 ? 'Low stock' : p.stock === 'in' ? 'In stock' : 'Confirm on order');
const stockTone = (p) => (p.stock === 'out' ? 'bad' : qtyOf(p) !== null && qtyOf(p) <= 5 ? 'warn' : p.stock === 'in' ? 'ok' : 'mute');
const delta = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const compact = (n) => (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n));
const phoneHref = (p) => 'tel:' + String(p).replace(/[^\d+]/g, '');
const pageNums = (pg, pages) => {
  const a = [...new Set([1, pages, pg - 1, pg, pg + 1])].filter((n) => n >= 1 && n <= pages).sort((x, y) => x - y);
  const out = [];
  a.forEach((n, i) => { if (i && n - a[i - 1] > 1) out.push('…' + n); out.push(n); });
  return out;
};

/* ───── sale pricing ─────
   `price` is always what the customer pays. `originalPrice` is the crossed-out
   regular price and only exists while a product is on sale. */
const regularOf = (p) => { const pr = Number(p.price || 0); const o = Number(p.originalPrice || 0); return o > pr ? o : pr; };
const onSale = (p) => Number(p.originalPrice || 0) > Number(p.price || 0) && Number(p.price || 0) > 0;
const pctOff = (reg, sale) => (reg > 0 ? Math.round(((reg - sale) / reg) * 100) : 0);
const roundTo = (n, step) => (step > 1 ? Math.round(n / step) * step : Math.round(n));
const calcSale = (regular, mode, v) => {
  const r = Number(regular); const x = Number(v);
  if (!Number.isFinite(r) || r <= 0 || v === '' || !Number.isFinite(x)) return '';
  if (mode === 'percent') return String(Math.max(0, Math.round(r * (1 - x / 100))));
  if (mode === 'amount') return String(Math.max(0, Math.round(r - x)));
  return String(Math.round(x));
};
const toPayload = (p, over = {}) => ({
  id: p.id, name: p.name || '', brand: p.brand || '', model: p.model || '',
  price: String(p.price ?? ''), originalPrice: onSale(p) ? String(p.originalPrice) : '',
  category: p.category || 'Watches', stock: p.stock || 'unknown',
  stockQuantity: p.stockQuantity === null || p.stockQuantity === undefined ? '' : String(p.stockQuantity),
  images: p.images || [], specs: p.specs || [], description: p.description || '',
  featured: !!p.featured, isNew: !!p.isNew, ...over,
});

/* ───── homepage marquee helpers ───── */
const readItems = (v) => {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string' && v.trim()) {
    try { const j = JSON.parse(v); if (Array.isArray(j)) return j.map(String); } catch {}
    return v.split('\n');
  }
  return [];
};
const readOn = (v) => v === true || v === 'true' || v === '1' || v === 1;
const mqState = (s) => ({
  on: s?.marquee_enabled === undefined || s?.marquee_enabled === null ? true : readOn(s.marquee_enabled),
  items: readItems(s?.marquee_items),
  speed: MQ_SPEEDS.some((x) => x[0] === s?.marquee_speed) ? s.marquee_speed : 'normal',
});
// Same formula the homepage uses, so the preview matches the real speed.
const mqSecs = (items, speed) => {
  const chars = items.join('').length + items.length * 8;
  return Math.round(Math.max(14, chars * 0.22) * (speed === 'slow' ? 1.7 : speed === 'fast' ? 0.6 : 1));
};

const Badge = ({ s }) => <span className={'ax-pill s-' + s}>{s}</span>;
const Pill = ({ tone, children }) => <span className={'ax-pill ' + tone}>{children}</span>;
function Meter({ value, max, tone = '', busy }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return <div className={'ax-meter ' + tone + (busy ? ' busy' : '')} aria-hidden="true"><i style={busy ? undefined : { width: pct + '%' }} /></div>;
}

/* ───────────── root ───────────── */
export default function AdminApp() {
  const [T, setT] = useState(null); // null = not read yet, '' = logged out
  const [D, setD] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('dash');
  const [drawer, setDrawer] = useState(null);
  const [ask, setAsk] = useState(null);
  const [q, setQ] = useState('');
  const [sf, setSf] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(12);
  const [sel, setSel] = useState(() => new Set());
  const [toastMsg, setToastMsg] = useState(null);
  const [health, setHealth] = useState(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nav, setNav] = useState(false);
  const timer = useRef(0);
  const dirtyRef = useRef(false);

  const notify = useCallback((text, kind = 'ok') => {
    setToastMsg({ text, kind, id: Date.now() });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastMsg(null), kind === 'error' ? 5000 : 3200);
  }, []);

  useEffect(() => {
    let t = '';
    try { t = sessionStorage.getItem('adm') || ''; } catch {}
    setT(t);
    const read = () => { const h = window.location.hash.slice(1); if (TABS.some((x) => x[0] === h)) setTab(h); };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!nav) return undefined;
    const key = (e) => { if (e.key === 'Escape') setNav(false); };
    document.addEventListener('keydown', key);
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = old; };
  }, [nav]);

  const logout = useCallback(() => { try { sessionStorage.removeItem('adm'); } catch {} setT(''); setD(null); setDrawer(null); setAsk(null); setHealth(null); setSel(new Set()); }, []);
  const api = useCallback(async (u, m = 'GET', b, token = T) => {
    const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json', 'x-admin-token': token || '' }, body: b ? JSON.stringify(b) : undefined });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && token) logout();
    if (!r.ok) throw new Error(j.error || 'Request failed');
    return j;
  }, [T, logout]);
  const load = useCallback(async () => {
    const data = await api('/api/admin/data');
    setD(data); setLoadError('');
    return data;
  }, [api]);
  useEffect(() => {
    if (T && !D) load().catch((x) => { setLoadError(x.message); notify(x.message, 'error'); });
  }, [T, D, load, notify]);

  const refresh = async () => {
    setRefreshing(true);
    try { await load(); notify('Store data refreshed'); } catch (x) { notify(x.message, 'error'); } finally { setRefreshing(false); }
  };

  // Runs a save/delete action. Returns true on success. Blocks double-submits.
  const run = async (f, ok) => {
    if (busy) return false;
    setBusy(true);
    try {
      const result = await f();
      notify(typeof ok === 'function' ? ok(result) : ok);
      try { await load(); } catch { notify('Saved, but the list could not refresh. Use Refresh.', 'error'); }
      return true;
    } catch (x) { notify(x.message, 'error'); return false; } finally { setBusy(false); }
  };

  const go = (k) => {
    setTab(k); setQ(''); setSf(''); setPage(1); setSel(new Set()); setDrawer(null); setNav(false);
    try { window.history.replaceState(null, '', '#' + k); } catch {}
    window.scrollTo(0, 0);
  };
  const openDrawer = (d) => { dirtyRef.current = false; setDrawer(d); };
  const closeDrawer = () => {
    if (dirtyRef.current) setAsk({ title: 'Discard your changes?', body: 'You have unsaved edits. If you close now they will be lost.', confirm: 'Discard changes', danger: true, action: () => { dirtyRef.current = false; setDrawer(null); } });
    else setDrawer(null);
  };

  const uploadFile = async (file, productId) => {
    if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) throw new Error(`${file.name}: use a JPG, PNG, WebP or AVIF image.`);
    if (file.size > MAX_IMAGE) throw new Error(`${file.name} is larger than 4 MB.`);
    const form = new FormData(); form.append('file', file); form.append('productId', productId || 'new-product');
    const r = await fetch('/api/admin/images', { method: 'POST', headers: { 'x-admin-token': T || '' }, body: form });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) logout();
    if (!r.ok) throw new Error(j.error || 'Image upload failed.');
    return j.url;
  };
  const checkHealth = async () => { setHealth('loading'); try { setHealth(await api('/api/admin/health')); } catch (e) { setHealth(null); notify(e.message, 'error'); } };

  const putOrder = (ref, body, ok) => run(() => api('/api/admin/orders/' + encodeURIComponent(ref), 'PUT', body), ok);
  const statusOk = (r) => (r?.notification === 'failed' ? 'Status updated, but the customer email failed' : r?.notification === 'sent' ? 'Status updated and customer emailed' : 'Status updated');
  const changeStatus = (o, status) => {
    if (status === o.status) return;
    if (status === 'cancelled') {
      setAsk({ title: `Cancel order ${o.ref}?`, body: 'The customer will be emailed that the order is cancelled. This cannot be undone.', confirm: 'Cancel order', cancel: 'Keep order', danger: true, action: () => putOrder(o.ref, { status }, statusOk) });
    } else putOrder(o.ref, { status }, statusOk);
  };
  const deleteProducts = (items, onDone) => setAsk({
    title: items.length === 1 ? `Delete “${items[0].name}”?` : `Delete ${items.length} products?`,
    body: 'They will disappear from your store. Past orders keep their details.', confirm: 'Delete', danger: true,
    action: async () => {
      const ok = await run(async () => {
        let done = 0;
        try { for (const p of items) { await api('/api/admin/products/' + encodeURIComponent(p.id), 'DELETE'); done++; } }
        catch (e) { await load().catch(() => {}); throw new Error(`Deleted ${done} of ${items.length}. ${e.message}`); }
        return done;
      }, (n) => (n === 1 ? 'Product deleted' : `${n} products deleted`));
      if (ok) { setSel(new Set()); onDone?.(); }
    },
  });

  const saveSale = (p, price, originalPrice, ok) => run(() => api('/api/admin/products', 'POST', toPayload(p, { price: String(price), originalPrice: originalPrice ? String(originalPrice) : '' })), ok);
  const bulkSale = (items, pct, step) => run(async () => {
    let done = 0;
    try {
      for (const p of items) {
        const reg = regularOf(p); const sale = roundTo(reg * (1 - pct / 100), step);
        if (!(sale >= 1 && sale < reg)) continue;
        await api('/api/admin/products', 'POST', toPayload(p, { price: String(sale), originalPrice: String(reg) }));
        done++;
      }
    } catch (e) { await load().catch(() => {}); throw new Error(`Updated ${done} of ${items.length}. ${e.message}`); }
    return done;
  }, (n) => `Sale applied to ${n} ${n === 1 ? 'watch' : 'watches'}`);
  const endSale = (items) => setAsk({
    title: items.length === 1 ? `End the sale on “${items[0].name}”?` : `End the sale on ${items.length} products?`,
    body: 'Prices go back to the regular price. The crossed-out price disappears from your store.', confirm: 'End sale',
    action: async () => {
      const ok = await run(async () => {
        let done = 0;
        try { for (const p of items) { if (!onSale(p)) continue; await api('/api/admin/products', 'POST', toPayload(p, { price: String(regularOf(p)), originalPrice: '' })); done++; } }
        catch (e) { await load().catch(() => {}); throw new Error(`Updated ${done}. ${e.message}`); }
        return done;
      }, (n) => (n === 1 ? 'Sale ended' : `${n} sales ended`));
      if (ok) setSel(new Set());
    },
  });
  const saveSettings = (body, ok) => run(() => api('/api/admin/settings', 'PUT', body), ok);

  /* derived data (hooks must run before any early return) */
  const orders = useMemo(() => [...(D?.orders || [])].sort((a, b) => new Date(b.date) - new Date(a.date)), [D]);
  const customers = useMemo(() => {
    const m = {};
    orders.forEach((o) => {
      const c0 = o.customer || {};
      const email = String(c0.email || '').trim().toLowerCase();
      const key = email || String(c0.phone || '').replace(/\D/g, '') || o.ref;
      const c = m[key] || (m[key] = { ...c0, email, key, n: 0, spent: 0, last: o.date });
      c.n++;
      if (o.status !== 'cancelled' && isPaid(o)) c.spent += Number(o.total || 0);
      if (new Date(o.date) > new Date(c.last)) c.last = o.date;
    });
    return Object.values(m).sort((a, b) => b.spent - a.spent || b.n - a.n);
  }, [orders]);
  const stats = useMemo(() => {
    const products = D?.products || [];
    const live = orders.filter((o) => o.status !== 'cancelled');
    const sum = (list) => list.reduce((a, o) => a + Number(o.total || 0), 0);
    const collected = sum(live.filter(isPaid));
    const outstanding = sum(live.filter((o) => !isPaid(o)));
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), short: d.toLocaleDateString('en-GB', { month: 'short' }), orders: 0, sales: 0, collected: 0 });
    }
    const byMonth = new Map(months.map((m) => [m.key, m]));
    const best = new Map();
    for (const o of live) {
      const d = new Date(o.date);
      const mo = Number.isFinite(d.getTime()) ? byMonth.get(`${d.getFullYear()}-${d.getMonth()}`) : null;
      if (mo) { mo.orders++; mo.sales += Number(o.total || 0); if (isPaid(o)) mo.collected += Number(o.total || 0); }
      for (const it of o.items || []) {
        const cur = best.get(it.id) || { id: it.id, name: it.name, units: 0, sales: 0 };
        cur.units += Number(it.qty || 0); cur.sales += Number(it.price || 0) * Number(it.qty || 0);
        best.set(it.id, cur);
      }
    }
    return {
      collected, outstanding, value: collected + outstanding,
      pending: orders.filter((o) => o.status === 'pending').length,
      low: products.filter(isLow), out: products.filter((p) => p.stock === 'out').length,
      sale: products.filter(onSale).length,
      months, top: [...best.values()].sort((a, b) => b.units - a.units).slice(0, 5),
    };
  }, [D, orders]);

  /* ───── guards ───── */
  if (T === null) return <div className="ax ax-center" aria-live="polite"><p className="ax-muted">Loading admin…</p></div>;
  if (!T) return <Login onLogin={(t) => { try { sessionStorage.setItem('adm', t); } catch {} setT(t); }} notify={notify} toast={toastMsg} />;
  if (!D) return (
    <div className="ax ax-center" aria-busy={!loadError}>
      <div className="ax-loadcard">
        <span className="ax-logo" aria-hidden="true">WF</span>
        <h1>Watch Flex PK</h1>
        {loadError ? (
          <>
            <p className="ax-err" role="alert">Couldn’t load your store data: {loadError}</p>
            <div className="ax-actions">
              <button className="ax-btn dark" type="button" onClick={() => { setLoadError(''); load().catch((x) => { setLoadError(x.message); notify(x.message, 'error'); }); }}>Try again</button>
              <button className="ax-btn" type="button" onClick={logout}>Log out</button>
            </div>
          </>
        ) : <><Meter busy /><p className="ax-muted" role="status">Loading your store data…</p></>}
      </div>
      <Toast t={toastMsg} />
    </div>
  );

  /* ───── shared pieces ───── */
  const openOrder = drawer?.type === 'order' ? orders.find((o) => o.ref === drawer.ref) : null;
  const [title, subtitle] = TITLES[tab] || TITLES.dash;
  const mq = mqState(D.settings);

  const paged = (list) => {
    const pages = Math.max(1, Math.ceil(list.length / size));
    const pg = Math.min(page, pages);
    return { rows: list.slice((pg - 1) * size, pg * size), pg, pages, total: list.length };
  };
  const pager = (p) => !p.total ? null : (
    <div className="ax-pager">
      <label>Per page
        <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }}>{SIZES.map((n) => <option key={n} value={n}>{n}</option>)}</select>
      </label>
      <span className="ax-range">{(p.pg - 1) * size + 1}–{Math.min(p.pg * size, p.total)} of {p.total}</span>
      <div className="ax-pages" role="navigation" aria-label="Pagination">
        <button type="button" disabled={p.pg <= 1} onClick={() => setPage(p.pg - 1)} aria-label="Previous page">‹</button>
        {pageNums(p.pg, p.pages).map((n) => (typeof n === 'string' ? <span key={n}>…</span> : <button key={n} type="button" className={n === p.pg ? 'on' : ''} aria-current={n === p.pg ? 'page' : undefined} onClick={() => setPage(n)}>{n}</button>))}
        <button type="button" disabled={p.pg >= p.pages} onClick={() => setPage(p.pg + 1)} aria-label="Next page">›</button>
      </div>
    </div>
  );

  const ordersTable = (list, compactMode) => !list.length ? <Empty icon="orders" title="No orders here" body="When customers place orders they will show up in this table." /> : (
    <div className="ax-tablewrap">
      <table className="ax-tbl">
        <thead><tr><th>Order</th>{compactMode ? null : <th>Date</th>}<th>Customer</th><th>Total</th>{compactMode ? null : <th>Payment</th>}<th>Status</th>{compactMode ? null : <th><span className="ax-sr">Next step</span></th>}</tr></thead>
        <tbody>{list.map((o) => {
          const c = o.customer || {};
          const next = NEXT[o.status];
          return (
            <tr key={o.ref} className="click" onClick={() => openDrawer({ type: 'order', ref: o.ref })}>
              <td data-label="Order"><button type="button" className="ax-ref" onClick={(e) => { e.stopPropagation(); openDrawer({ type: 'order', ref: o.ref }); }}>{o.ref}</button></td>
              {compactMode ? null : <td data-label="Date">{day(o.date)}</td>}
              <td data-label="Customer"><span className="ax-cell"><b>{c.name || 'Unknown customer'}</b><small>{c.city || '—'}</small></span></td>
              <td data-label="Total"><b>{pkr(o.total)}</b></td>
              {compactMode ? null : <td data-label="Payment"><span className={isPaid(o) ? 'ax-ok' : 'ax-due'}>{isPaid(o) ? 'Collected' : 'Due on delivery'}</span></td>}
              <td data-label="Status"><Badge s={o.status} /></td>
              {compactMode ? null : <td className="act">{next ? <button type="button" className="ax-btn sm" disabled={busy} onClick={(e) => { e.stopPropagation(); changeStatus(o, next[0]); }}>{next[1]}</button> : null}</td>}
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );

  const exportCsv = () => {
    const risky = (t) => /^[=@\t\r]/.test(t) || /^[+-](?![\d\s()-]+$)/.test(t);
    const cell = (v) => { let t = String(v ?? ''); if (typeof v !== 'number' && risky(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
    const headRow = ['Order', 'Date', 'Name', 'Email', 'Phone', 'City', 'Address', 'Items', 'Promo', 'Discount', 'Delivery fee', 'Total', 'Payment', 'Payment status', 'Courier', 'Tracking number', 'Status'];
    const rows = orders.map((o) => { const c = o.customer || {}; return [o.ref, o.date, c.name, c.email, c.phone, c.city, c.address, (o.items || []).map((i) => i.name + ' x' + i.qty).join('; '), o.promo, o.discount, o.delivery_fee ?? o.deliveryFee ?? 0, o.total, o.payment || 'Cash on delivery', o.payment_status || o.paymentStatus || 'pending', o.shipping?.carrier || '', o.shipping?.trackingNumber || '', o.status]; });
    const blob = new Blob(['\uFEFF' + [headRow, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'watch-flex-orders.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /* ───── views ───── */
  const dash = () => {
    const cur = stats.months[5], prev = stats.months[4];
    const bestMonth = Math.max(...stats.months.map((m) => m.sales), 0);
    const d = delta(cur.sales, prev.sales);
    const collectedPct = stats.value > 0 ? Math.round((stats.collected / stats.value) * 100) : 0;
    const activePromos = (D.promos || []).filter((p) => p.active).length;
    return (
      <div className="ax-dash">
        <div className="ax-dmain">
          <div className="ax-kpis">
            <section className="ax-card ax-kpi">
              <div className="ax-kh"><span className="ax-tile"><Icon n="orders" /></span><h2>Order value</h2></div>
              <div className="ax-big"><b>{pkr(stats.value)}</b><small>{orders.length} {orders.length === 1 ? 'order' : 'orders'}</small></div>
              <div className="ax-kf">
                <Meter value={cur.sales} max={bestMonth} />
                <span className={'ax-chipnum ' + (d === null ? '' : d >= 0 ? 'up' : 'down')}>{d === null ? 'New month' : `${d >= 0 ? '+' : '−'}${Math.abs(d)}% vs last month`}</span>
              </div>
            </section>
            <section className="ax-card lime ax-kpi">
              <div className="ax-kh"><span className="ax-tile"><Icon n="wallet" /></span><h2>Cash collected</h2></div>
              <div className="ax-big"><b>{pkr(stats.collected)}</b><small>{pkr(stats.outstanding)} still due</small></div>
              <div className="ax-kf">
                <Meter value={stats.collected} max={stats.value} />
                <span className="ax-chipnum">{collectedPct}% collected</span>
              </div>
            </section>
            <section className="ax-card dark ax-cta">
              <h2>{stats.pending ? `${stats.pending} ${stats.pending === 1 ? 'order needs' : 'orders need'} you` : 'You’re all caught up'}</h2>
              <p>{stats.pending ? 'Customers hear from you once you confirm.' : 'No orders are waiting for confirmation.'}</p>
              <button type="button" className="ax-btn white wide" onClick={() => { go('orders'); if (stats.pending) setSf('pending'); }}>{stats.pending ? 'Review orders' : 'View orders'}<Icon n="arrow" size={16} /></button>
            </section>
          </div>

          <section className="ax-card ax-statcard">
            <div className="ax-cardhead">
              <div className="ax-kh"><span className="ax-tile"><Icon n="orders" /></span><h2>Sales, last 6 months</h2></div>
              <div className="ax-legend"><span><i className="d" />Order value</span><span><i className="l" />Collected</span></div>
            </div>
            <SalesChart months={stats.months} />
          </section>

          <div className="ax-minis">
            <div className="ax-mini"><span>Customers</span><b>{customers.length}</b><small>Unique buyers</small></div>
            <div className="ax-mini"><span>Products</span><b>{D.products.length}</b><small>{stats.sale} on sale, {stats.out} out of stock</small></div>
            <div className="ax-mini"><span>Promo codes</span><b>{activePromos}</b><small>{(D.promos || []).length} in total</small></div>
            <div className="ax-mini"><span>This month</span><b>{cur.orders}</b><small>{cur.orders === 1 ? 'order' : 'orders'} so far</small></div>
          </div>

          <div className="ax-two">
            <section className="ax-card">
              <div className="ax-cardhead"><h2>Best sellers</h2></div>
              {!stats.top.length ? <p className="ax-muted">No sales yet.</p> : (
                <ol className="ax-rank">{stats.top.map((p, i) => (
                  <li key={p.id}><span className="n">{i + 1}</span><span className="t"><b>{p.name}</b><small>{p.units} {p.units === 1 ? 'unit' : 'units'} sold</small></span><span className="v">{pkr(p.sales)}</span></li>
                ))}</ol>
              )}
            </section>
            <section className="ax-card">
              <div className="ax-cardhead"><h2>Latest orders</h2><button type="button" className="ax-linkbtn" onClick={() => go('orders')}>View all</button></div>
              {ordersTable(orders.slice(0, 5), true)}
            </section>
          </div>
        </div>

        <aside className="ax-aside" aria-label="Shortcuts">
          <div className="ax-qgrid">
            <button type="button" className="ax-q" onClick={() => openDrawer({ type: 'product', item: null })}><span className="ax-tile"><Icon n="plus" /></span>Add product</button>
            <button type="button" className="ax-q" onClick={() => openDrawer({ type: 'promo', item: null })}><span className="ax-tile"><Icon n="promo" /></span>New promo</button>
          </div>
          <button type="button" className="ax-row" onClick={() => go('site')}><span className="ax-tile"><Icon n="mq" /></span><span><b>Homepage marquee</b><small>{mq.on ? `On, ${mq.items.filter((x) => x.trim()).length} messages` : 'Turned off'}</small></span><Icon n="arrow" size={16} /></button>
          <button type="button" className="ax-row" onClick={() => go('products')}><span className="ax-tile"><Icon n="percent" /></span><span><b>Run a sale</b><small>Cross out a price and set a new one</small></span><Icon n="arrow" size={16} /></button>
          <button type="button" className="ax-row" onClick={exportCsv} disabled={!orders.length}><span className="ax-tile"><Icon n="download" /></span><span><b>Export orders</b><small>Download every order as CSV</small></span><Icon n="arrow" size={16} /></button>
          <button type="button" className="ax-row" onClick={() => go('settings')}><span className="ax-tile"><Icon n="truck" /></span><span><b>Delivery charge</b><small>{Number(D.settings?.delivery_fee) ? pkr(D.settings.delivery_fee) : 'Free delivery'} right now</small></span><Icon n="arrow" size={16} /></button>
          <section className="ax-card ax-watchlist">
            <div className="ax-cardhead"><h2>Stock to watch</h2>{stats.low.length ? <Pill tone="warn">{stats.low.length}</Pill> : null}</div>
            {!stats.low.length ? <p className="ax-muted">Everything is stocked.</p> : (
              <ul>{stats.low.slice(0, 6).map((p) => (
                <li key={p.id}><button type="button" onClick={() => openDrawer({ type: 'product', item: p })}><span><b>{p.name}</b><small>{stockLabel(p)}</small></span><em>{qtyOf(p) ?? '—'}</em></button></li>
              ))}</ul>
            )}
          </section>
        </aside>
      </div>
    );
  };

  const ordersView = () => {
    const term = q.trim().toLowerCase();
    const l = orders.filter((o) => {
      if (sf && o.status !== sf) return false;
      if (!term) return true;
      const c = o.customer || {};
      return [o.ref, c.name, c.phone, c.email, c.city].some((v) => String(v || '').toLowerCase().includes(term));
    });
    const counts = Object.fromEntries(STATUSES.map((s) => [s, orders.filter((o) => o.status === s).length]));
    const p = paged(l);
    return (
      <>
        <div className="ax-tabs" role="group" aria-label="Filter orders by status">
          <button type="button" className={!sf ? 'on' : ''} aria-pressed={!sf} onClick={() => { setSf(''); setPage(1); }}>All <i>{orders.length}</i></button>
          {STATUSES.map((s) => <button key={s} type="button" className={sf === s ? 'on' : ''} aria-pressed={sf === s} onClick={() => { setSf(s); setPage(1); }}>{s} <i>{counts[s]}</i></button>)}
        </div>
        <section className="ax-card flush">
          <div className="ax-toolbar">
            <Search value={q} onChange={(v) => { setQ(v); setPage(1); }} label="Search orders by number, name, phone, email or city" placeholder="Search order, name, phone, email" />
            <span className="ax-hint">Changing a status emails the customer.</span>
          </div>
          {ordersTable(p.rows)}
          {pager(p)}
        </section>
      </>
    );
  };

  const productsView = () => {
    const term = q.trim().toLowerCase();
    const l = D.products.filter((x) => !term || [x.name, x.brand, x.model, x.category].some((v) => String(v || '').toLowerCase().includes(term)));
    const p = paged(l);
    const selected = D.products.filter((x) => sel.has(x.id));
    const allOn = p.rows.length > 0 && p.rows.every((x) => sel.has(x.id));
    const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    return (
      <>
        <div className="ax-toolbar solo">
          <Search value={q} onChange={(v) => { setQ(v); setPage(1); }} label="Search products" placeholder="Search products" />
          {p.rows.length ? <button type="button" className="ax-btn sm" onClick={() => setSel((s) => { const n = new Set(s); p.rows.forEach((x) => (allOn ? n.delete(x.id) : n.add(x.id))); return n; })}>{allOn ? 'Unselect page' : 'Select page'}</button> : null}
          <span className="ax-hint">{stats.sale} on sale</span>
        </div>
        {!l.length ? <Empty icon="watch" title={D.products.length ? 'No products match your search' : 'No products yet'} body={D.products.length ? 'Try a different name, brand or model.' : 'Add your first watch to start selling.'} action={!D.products.length && <button type="button" className="ax-btn dark" onClick={() => openDrawer({ type: 'product', item: null })}>Add product</button>} /> : (
          <div className="ax-pgrid">{p.rows.map((x) => {
            const sale = onSale(x); const reg = regularOf(x); const qty = qtyOf(x);
            return (
              <article key={x.id} className={'ax-pcard' + (sel.has(x.id) ? ' picked' : '')}>
                <div className="ax-pimg">
                  {x.images?.[0] ? <img src={x.images[0]} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /> : <span className="ax-noimg"><Icon n="watch" size={40} /></span>}
                  <label className="ax-pchk"><input type="checkbox" checked={sel.has(x.id)} onChange={() => toggle(x.id)} /><span className="ax-sr">Select {x.name}</span><i><Icon n="check" size={14} /></i></label>
                  <div className="ax-pbadges">{sale ? <span className="ax-off">−{pctOff(reg, Number(x.price))}%</span> : null}{x.isNew ? <span className="ax-tag">New</span> : null}{x.featured ? <span className="ax-tag">Featured</span> : null}</div>
                </div>
                <div className="ax-pbody">
                  <div className="ax-pname"><button type="button" onClick={() => openDrawer({ type: 'product', item: x })}>{x.name}</button><small>{[x.brand, x.model].filter(Boolean).join(' ') || x.category}</small></div>
                  <p className={'ax-pdesc' + (x.description ? '' : ' none')}>{x.description || 'No description yet'}</p>
                  <div className="ax-priceline"><b>{pkr(x.price)}</b>{sale ? <s aria-label={`Regular price ${pkr(reg)}`}>{pkr(reg)}</s> : null}</div>
                  <div className="ax-stockrow">{qty !== null ? <Meter value={Math.min(qty, 10)} max={10} tone={stockTone(x)} /> : null}<Pill tone={stockTone(x)}>{stockLabel(x)}{qty !== null ? `, ${qty}` : ''}</Pill></div>
                  <div className="ax-pfoot">
                    <button type="button" className="ax-btn sm" aria-label={`Edit ${x.name}`} onClick={() => openDrawer({ type: 'product', item: x })}><Icon n="edit" size={15} />Edit</button>
                    <button type="button" className={'ax-btn sm' + (sale ? ' lime' : '')} aria-label={`${sale ? 'Edit sale for' : 'Put on sale:'} ${x.name}`} onClick={() => openDrawer({ type: 'sale', item: x })}><Icon n="percent" size={15} />{sale ? 'Edit sale' : 'Sale'}</button>
                  </div>
                </div>
              </article>
            );
          })}</div>
        )}
        {pager(p)}
        {selected.length ? <div className="ax-bulkspace" aria-hidden="true" /> : null}
        {selected.length ? (
          <div className="ax-bulk" role="region" aria-label="Bulk actions">
            <span><b>{selected.length}</b> selected</span>
            <button type="button" className="ax-btn sm lime" onClick={() => openDrawer({ type: 'bulk', items: selected })}><Icon n="percent" size={15} />Apply sale</button>
            {selected.some(onSale) ? <button type="button" className="ax-btn sm ghost" onClick={() => endSale(selected)}>End sale</button> : null}
            <button type="button" className="ax-btn sm ghost danger" onClick={() => deleteProducts(selected)}>Delete</button>
            <button type="button" className="ax-x sm" onClick={() => setSel(new Set())} aria-label="Clear selection"><Icon n="x" size={15} /></button>
          </div>
        ) : null}
      </>
    );
  };

  const promosView = () => {
    const p = paged(D.promos || []);
    return (
      <>
        {!p.total ? <Empty icon="promo" title="No promo codes yet" body="Create a code to run a sale or reward repeat customers." action={<button type="button" className="ax-btn dark" onClick={() => openDrawer({ type: 'promo', item: null })}>New promo code</button>} /> : (
          <section className="ax-card flush">
            <div className="ax-tablewrap">
              <table className="ax-tbl">
                <thead><tr><th>Code</th><th>Discount</th><th>Minimum order</th><th>Used</th><th>Status</th><th><span className="ax-sr">Actions</span></th></tr></thead>
                <tbody>{p.rows.map((x) => (
                  <tr key={x.code} className="click" onClick={() => openDrawer({ type: 'promo', item: x })}>
                    <td data-label="Code"><b className="ax-code">{x.code}</b></td>
                    <td data-label="Discount"><b>{x.type === 'percent' ? `${x.value}% off` : `${pkr(x.value)} off`}</b></td>
                    <td data-label="Minimum order">{Number(x.min) ? pkr(x.min) : 'None'}</td>
                    <td data-label="Used">
                      <div className="ax-used"><span>{Number(x.used || 0)}{Number(x.max) ? ` of ${x.max}` : ' (no limit)'}</span>{Number(x.max) ? <Meter value={Number(x.used || 0)} max={Number(x.max)} /> : null}</div>
                    </td>
                    <td data-label="Status"><Pill tone={x.active ? 'ok' : 'mute'}>{x.active ? 'Active' : 'Off'}</Pill></td>
                    <td className="act">
                      <button type="button" className="ax-btn sm" aria-label={`Edit promo ${x.code}`} onClick={(e) => { e.stopPropagation(); openDrawer({ type: 'promo', item: x }); }}>Edit</button>
                      <button type="button" className="ax-btn sm ghost danger" aria-label={`Delete promo ${x.code}`} onClick={(e) => { e.stopPropagation(); setAsk({ title: `Delete code ${x.code}?`, body: 'Customers will no longer be able to use it.', confirm: 'Delete code', danger: true, action: () => run(() => api('/api/admin/promos/' + encodeURIComponent(x.code), 'DELETE'), 'Promo code deleted') }); }}>Delete</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {pager(p)}
          </section>
        )}
      </>
    );
  };

  const custView = () => {
    const term = q.trim().toLowerCase();
    const l = customers.filter((c) => !term || [c.name, c.email, c.phone, c.city].some((v) => String(v || '').toLowerCase().includes(term)));
    const p = paged(l);
    return (
      <section className="ax-card flush">
        <div className="ax-toolbar"><Search value={q} onChange={(v) => { setQ(v); setPage(1); }} label="Search customers" placeholder="Search name, email, phone, city" /></div>
        {!l.length ? <Empty icon="cust" title={customers.length ? 'No customers match your search' : 'No customers yet'} body={customers.length ? 'Try a different name or email.' : 'Customers appear here after their first order.'} /> : (
          <div className="ax-tablewrap">
            <table className="ax-tbl">
              <thead><tr><th>Customer</th><th>Contact</th><th>City</th><th>Orders</th><th>Spent</th><th>Last order</th></tr></thead>
              <tbody>{p.rows.map((c) => (
                <tr key={c.key}>
                  <td data-label="Customer"><div className="ax-who"><span className="ax-av" aria-hidden="true">{initials(c.name)}</span><b>{c.name || 'Unnamed customer'}</b></div></td>
                  <td data-label="Contact"><span className="ax-cell">{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : null}{c.phone ? <a href={phoneHref(c.phone)}>{c.phone}</a> : null}{!c.email && !c.phone ? '—' : null}</span></td>
                  <td data-label="City">{c.city || '—'}</td>
                  <td data-label="Orders">{c.n}</td>
                  <td data-label="Spent"><b>{pkr(c.spent)}</b></td>
                  <td data-label="Last order">{day(c.last)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {pager(p)}
      </section>
    );
  };

  const siteView = () => (
    <div className="ax-two">
      <section className="ax-card">
        <div className="ax-kh"><span className="ax-tile"><Icon n="mq" /></span><h2>Homepage marquee</h2></div>
        <p className="ax-muted ax-lead">The scrolling banner at the top of your homepage. Changes go live as soon as you save.</p>
        <MarqueeForm s={D.settings} busy={busy} onSave={(body) => saveSettings(body, body.marquee_enabled ? 'Marquee saved and live on the homepage' : 'Marquee turned off')} />
      </section>
      <section className="ax-card">
        <div className="ax-kh"><span className="ax-tile"><Icon n="check" /></span><h2>Tips</h2></div>
        <ul className="ax-tips">
          <li>Keep each message short. One line reads best on phones.</li>
          <li>Use 3 to 6 messages. Too many makes the loop feel long.</li>
          <li>Good topics: free or flat delivery, cash on delivery, new arrivals, active sale or promo code.</li>
          <li>Turn the marquee off to hide the banner completely.</li>
        </ul>
      </section>
    </div>
  );

  const settingsView = () => (
    <div className="ax-two">
      <section className="ax-card">
        <div className="ax-kh"><span className="ax-tile"><Icon n="truck" /></span><h2>Delivery</h2></div>
        <SettingsForm initial={D.settings?.delivery_fee ?? 0} busy={busy} onSave={(fee) => saveSettings({ delivery_fee: fee }, 'Store settings saved')} />
      </section>
      <section className="ax-card">
        <div className="ax-kh"><span className="ax-tile"><Icon n="check" /></span><h2>Service connections</h2></div>
        <p className="ax-muted ax-lead">Checks the services set up on your server. Secret values are never shown.</p>
        <div className="ax-gap"><button type="button" className="ax-btn" onClick={checkHealth} disabled={health === 'loading'}>{health === 'loading' ? 'Testing…' : 'Test connections'}</button></div>
        {health && health !== 'loading' ? (
          <div className="ax-tablewrap"><table className="ax-tbl plain"><tbody>{Object.entries(health).map(([k, v]) => {
            const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
            const good = /^(ok|connected|configured|true|ready|healthy)/i.test(s);
            return <tr key={k}><td data-label="Service" className="cap">{k.replaceAll('_', ' ')}</td><td data-label="Result"><Pill tone={good ? 'ok' : /^(false|missing|error|fail)/i.test(s) ? 'bad' : 'mute'}>{s}</Pill></td></tr>;
          })}</tbody></table></div>
        ) : null}
      </section>
    </div>
  );

  const views = { dash, orders: ordersView, products: productsView, promos: promosView, cust: custView, site: siteView, settings: settingsView };
  const headAction = tab === 'orders' ? <button type="button" className="ax-btn" onClick={exportCsv} disabled={!orders.length}><Icon n="download" size={16} />Export CSV</button>
    : tab === 'products' || tab === 'dash' ? <button type="button" className="ax-btn dark" onClick={() => openDrawer({ type: 'product', item: null })}><Icon n="plus" size={16} />Add product</button>
    : tab === 'promos' ? <button type="button" className="ax-btn dark" onClick={() => openDrawer({ type: 'promo', item: null })}><Icon n="plus" size={16} />New promo code</button> : null;

  return (
    <div className="ax">
      <div className="ax-shell">
        {nav ? <div className="ax-scrim" onClick={() => setNav(false)} aria-hidden="true" /> : null}
        <aside className={'ax-rail' + (nav ? ' open' : '')} aria-label="Main menu">
          <div className="ax-brand"><span className="ax-logo" aria-hidden="true">WF</span><span><b>Watch Flex PK</b><small>Store admin</small></span></div>
          <nav aria-label="Admin sections" className="ax-rnav">
            {TABS.map((t) => (
              <button key={t[0]} type="button" className={tab === t[0] ? 'on' : ''} aria-current={tab === t[0] ? 'page' : undefined} onClick={() => go(t[0])}>
                <Icon n={t[2]} size={18} /><span>{t[1]}</span>
                {t[0] === 'orders' && stats.pending ? <em aria-label={`${stats.pending} pending`}>{stats.pending}</em> : null}
              </button>
            ))}
          </nav>
          <button type="button" className="ax-out" onClick={logout}><Icon n="logout" size={18} /><span>Log out</span></button>
        </aside>
        <div className="ax-panel">
          <div className="ax-mtop">
            <button type="button" className="ax-ibtn" onClick={() => setNav(true)} aria-label="Open menu" aria-expanded={nav}><Icon n="menu" size={20} /></button>
            <span className="ax-brand"><span className="ax-logo sm" aria-hidden="true">WF</span><b>Watch Flex PK</b></span>
            <button type="button" className={'ax-ibtn' + (refreshing ? ' spin' : '')} onClick={refresh} disabled={refreshing} aria-label="Refresh data"><Icon n="refresh" size={18} /></button>
          </div>
          <header className="ax-head">
            <div><h1 className="ax-title">{title}</h1><p className="ax-sub">{subtitle}</p></div>
            <div className="ax-actions">
              <button type="button" className={'ax-btn ax-refresh' + (refreshing ? ' spin' : '')} onClick={refresh} disabled={refreshing}><Icon n="refresh" size={16} />{refreshing ? 'Refreshing…' : 'Refresh'}</button>
              {headAction}
            </div>
          </header>
          <main className="ax-main" key={tab}>{views[tab]()}</main>
        </div>
      </div>

      {drawer?.type === 'order' ? (
        <Drawer title={openOrder ? `Order ${openOrder.ref}` : 'Order not found'} sub={openOrder ? when(openOrder.date) : ''} onClose={closeDrawer}>
          {openOrder ? <OrderDetail key={openOrder.ref} o={openOrder} busy={busy} onStatus={changeStatus} onSave={(body) => putOrder(openOrder.ref, body, (r) => (r?.notification === 'failed' ? 'Saved, but the customer email failed' : r?.notification === 'sent' ? 'Saved and customer emailed' : 'Delivery details saved'))} /> : <p className="ax-muted">This order is no longer in your list. Refresh and try again.</p>}
        </Drawer>
      ) : null}
      {drawer?.type === 'product' ? (
        <Drawer title={drawer.item ? 'Edit product' : 'Add product'} sub={drawer.item?.name} onClose={closeDrawer} wide>
          <ProductForm key={drawer.item?.id || 'new'} p={drawer.item || {}} busy={busy} onDirty={(v) => { dirtyRef.current = v; }} onUpload={uploadFile} onCancel={closeDrawer}
            onDelete={drawer.item ? () => deleteProducts([drawer.item], () => { dirtyRef.current = false; setDrawer(null); }) : null}
            onSave={async (payload) => { if (await run(() => api('/api/admin/products', 'POST', { ...payload, id: drawer.item?.id }), 'Product saved')) { dirtyRef.current = false; setDrawer(null); } }} onError={(m) => notify(m, 'error')} />
        </Drawer>
      ) : null}
      {drawer?.type === 'sale' ? (
        <Drawer title={onSale(drawer.item) ? 'Edit sale price' : 'Put on sale'} sub={drawer.item.name} onClose={closeDrawer}>
          <QuickSale key={drawer.item.id} p={drawer.item} busy={busy} onCancel={closeDrawer}
            onEnd={onSale(drawer.item) ? () => { setDrawer(null); endSale([drawer.item]); } : null}
            onSave={async (price, original) => { if (await saveSale(drawer.item, price, original, original ? 'Sale price saved' : 'Price saved')) setDrawer(null); }} />
        </Drawer>
      ) : null}
      {drawer?.type === 'bulk' ? (
        <Drawer title="Apply a sale" sub={`${drawer.items.length} selected`} onClose={closeDrawer}>
          <BulkSale items={drawer.items} busy={busy} onCancel={closeDrawer}
            onApply={async (pct, step) => { if (await bulkSale(drawer.items, pct, step)) { setDrawer(null); setSel(new Set()); } }} />
        </Drawer>
      ) : null}
      {drawer?.type === 'promo' ? (
        <Drawer title={drawer.item ? `Edit ${drawer.item.code}` : 'New promo code'} onClose={closeDrawer}>
          <PromoForm key={drawer.item?.code || 'new'} p={drawer.item} busy={busy} onDirty={(v) => { dirtyRef.current = v; }} onCancel={closeDrawer}
            onSave={async (payload) => { if (await run(() => api('/api/admin/promos', 'POST', payload), 'Promo code saved')) { dirtyRef.current = false; setDrawer(null); } }} />
        </Drawer>
      ) : null}
      {ask ? <Confirm {...ask} onClose={() => setAsk(null)} onConfirm={() => { const a = ask.action; setAsk(null); a?.(); }} /> : null}
      <Toast t={toastMsg} />
    </div>
  );
}

/* ───────────── small pieces ───────────── */
function SalesChart({ months }) {
  const [hot, setHot] = useState(months.length - 1);
  const max = Math.max(...months.map((m) => m.sales), 0);
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((t) => Math.round(max * t));
  const hm = months[hot] || months[months.length - 1];
  const hShare = hm.sales > 0 ? Math.round((hm.collected / hm.sales) * 100) : 0;
  return (
    <div>
      <p className="ax-chartinfo" aria-live="polite">
        <b>{hm.label}</b>
        <span>{hm.orders ? `${hm.orders} ${hm.orders === 1 ? 'order' : 'orders'}, ${pkr(hm.sales)}, ${hShare}% collected` : 'No orders'}</span>
      </p>
      <div className="ax-chart">
        <div className="ax-yaxis" aria-hidden="true">{ticks.map((t, i) => <span key={i}>{compact(t)}</span>)}</div>
        <div className="ax-plot">
          <div className="ax-gridlines" aria-hidden="true">{ticks.map((t, i) => <i key={i} />)}</div>
          <div className="ax-bars">
            {months.map((m, i) => {
              const h = m.sales > 0 && max > 0 ? Math.max(8, (m.sales / max) * 100) : 0;
              const share = m.sales > 0 ? Math.round((m.collected / m.sales) * 100) : 0;
              return (
                <div className="ax-bcol" key={m.key}>
                  <div className="ax-zone">
                    <button type="button" className={'ax-bar' + (i === hot ? ' hot' : '') + (h ? '' : ' empty')} style={{ height: h ? h + '%' : '4px', '--i': i }}
                      onMouseEnter={() => setHot(i)} onFocus={() => setHot(i)} onClick={() => setHot(i)}
                      aria-label={`${m.label}: ${m.orders} ${m.orders === 1 ? 'order' : 'orders'}, order value ${pkr(m.sales)}, collected ${pkr(m.collected)}`}>
                      {h ? <span className="ax-bfill" style={{ height: share + '%' }} /> : null}
                    </button>
                  </div>
                  <span className={'ax-bl' + (i === hot ? ' hot' : '')}>{m.short}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
function Toast({ t }) {
  return (
    <div className="ax-toasts" aria-live="polite" role="status">
      {t ? <div key={t.id} className={'ax-toast ' + t.kind} role={t.kind === 'error' ? 'alert' : undefined}><Icon n={t.kind === 'error' ? 'alert' : 'check'} size={15} />{t.text}</div> : null}
    </div>
  );
}
function Search({ value, onChange, label, placeholder }) {
  return (
    <label className="ax-search"><span className="ax-sr">{label}</span>
      <input type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function Empty({ icon = 'cog', title, body, action }) {
  return <div className="ax-empty"><span className="ax-tile lg"><Icon n={icon} size={26} /></span><h3>{title}</h3><p>{body}</p>{action || null}</div>;
}
function Drawer({ title, sub, onClose, children, wide }) {
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement;
    const key = (e) => {
      if (e.key === 'Escape' && !document.querySelector('.ax-modal')) { closeRef.current(); return; }
      if (e.key !== 'Tab' || document.querySelector('.ax-modal') || !panel.current) return;
      const f = [...panel.current.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0]; const last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = old; prev?.focus?.(); };
  }, []);
  return (
    <div className="ax-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeRef.current(); }}>
      <div className={'ax-drawer' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title} ref={panel} tabIndex={-1}>
        <div className="ax-dhead"><div><h2>{title}</h2>{sub ? <small>{sub}</small> : null}</div><button type="button" className="ax-x" onClick={() => closeRef.current()} aria-label="Close"><Icon n="x" size={16} /></button></div>
        <div className="ax-dbody">{children}</div>
      </div>
    </div>
  );
}
function Confirm({ title, body, confirm = 'Confirm', cancel = 'Cancel', danger, onClose, onConfirm }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); } };
    document.addEventListener('keydown', key, true);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', key, true);
  }, []);
  return (
    <div className="ax-overlay ax-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ax-dialog" role="alertdialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2><p>{body}</p>
        <div className="ax-actions end">
          <button type="button" className="ax-btn" ref={ref} onClick={onClose}>{cancel}</button>
          <button type="button" className={'ax-btn ' + (danger ? 'solid-danger' : 'dark')} onClick={onConfirm}>{confirm}</button>
        </div>
      </div>
    </div>
  );
}

/* ───────────── homepage marquee editor ───────────── */
function MarqueePreview({ items, speed, on }) {
  const list = items.map((t) => t.trim()).filter(Boolean);
  const shown = list.length ? list : ['Your message appears here'];
  const row = shown.map((t, i) => <span key={i} className="ax-mqi">{t}<b aria-hidden="true">◆</b></span>);
  return (
    <div className={'ax-mq' + (on ? '' : ' off')} role="img" aria-label={on ? 'Marquee preview' : 'Marquee is turned off'}>
      {on ? <div className="ax-mqt" style={{ animationDuration: mqSecs(shown, speed) + 's' }}><div>{row}</div><div aria-hidden="true">{row}</div></div> : <span className="ax-mqoff">Marquee is hidden on your homepage</span>}
    </div>
  );
}

function MarqueeForm({ s, busy, onSave }) {
  const saved = mqState(s);
  const savedKey = JSON.stringify(saved);
  const [f, setF] = useState(saved);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { setF(JSON.parse(savedKey)); }, [savedKey]);
  const clean = f.items.map((t) => t.trim()).filter(Boolean);
  const dirty = JSON.stringify({ ...f, items: clean }) !== JSON.stringify({ ...saved, items: saved.items.map((t) => t.trim()).filter(Boolean) });
  const full = f.items.length >= MQ_MAX_ITEMS;
  const add = (text) => {
    const t = String(text).trim();
    if (!t) return;
    if (full) { setErr(`You can add up to ${MQ_MAX_ITEMS} messages.`); return; }
    setErr(''); setF((x) => ({ ...x, items: [...x.items, t.slice(0, MQ_MAX_LEN)] })); setDraft('');
  };
  const edit = (i, v) => setF((x) => ({ ...x, items: x.items.map((t, k) => (k === i ? v : t)) }));
  const move = (i, d) => setF((x) => { const a = [...x.items]; const j = i + d; if (j < 0 || j >= a.length) return x; [a[i], a[j]] = [a[j], a[i]]; return { ...x, items: a }; });
  const remove = (i) => setF((x) => ({ ...x, items: x.items.filter((_, k) => k !== i) }));
  const submit = (e) => {
    e.preventDefault();
    const pending = draft.trim();
    const items = pending && clean.length < MQ_MAX_ITEMS ? [...clean, pending.slice(0, MQ_MAX_LEN)] : clean;
    if (f.on && !items.length) return setErr('Add at least one message, or turn the marquee off.');
    setErr(''); setDraft('');
    onSave({ marquee_enabled: f.on, marquee_items: items, marquee_speed: f.speed });
  };
  return (
    <form className="ax-form" onSubmit={submit} noValidate>
      <MarqueePreview items={draft.trim() ? [...f.items, draft] : f.items} speed={f.speed} on={f.on} />
      <label className="ax-switch">
        <input type="checkbox" role="switch" checked={f.on} onChange={(e) => setF((x) => ({ ...x, on: e.target.checked }))} />
        <span className="track" aria-hidden="true"><i /></span>
        <span><b>Show marquee on homepage</b><small>{f.on ? 'Visible to every visitor' : 'Hidden from visitors'}</small></span>
      </label>
      <div className="ax-field">Speed
        <div className="ax-seg" role="group" aria-label="Marquee speed">{MQ_SPEEDS.map(([k, t]) => <button key={k} type="button" className={f.speed === k ? 'on' : ''} aria-pressed={f.speed === k} onClick={() => setF((x) => ({ ...x, speed: k }))}>{t}</button>)}</div>
      </div>
      <section className="ax-block"><h3>Messages <small className="ax-muted">{f.items.length} of {MQ_MAX_ITEMS}</small></h3>
        {f.items.length ? (
          <ol className="ax-mqlist">{f.items.map((t, i) => (
            <li key={i}>
              <input value={t} maxLength={MQ_MAX_LEN} onChange={(e) => edit(i, e.target.value)} aria-label={`Message ${i + 1}`} />
              <div className="ax-mqbtns">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move message ${i + 1} up`}><Icon n="up" size={15} /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === f.items.length - 1} aria-label={`Move message ${i + 1} down`}><Icon n="down" size={15} /></button>
                <button type="button" className="danger" onClick={() => remove(i)} aria-label={`Remove message ${i + 1}`}><Icon n="x" size={14} /></button>
              </div>
            </li>
          ))}</ol>
        ) : <p className="ax-muted">No messages yet. Add your first one below.</p>}
        <div className="ax-inline">
          <input value={draft} maxLength={MQ_MAX_LEN} onChange={(e) => setDraft(e.target.value)} placeholder="Type a new message" aria-label="New message" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(draft); } }} />
          <button type="button" className="ax-btn" onClick={() => add(draft)} disabled={!draft.trim() || full}>Add</button>
        </div>
        <div className="ax-chips" role="group" aria-label="Message ideas">
          {MQ_IDEAS.filter((t) => !f.items.includes(t)).map((t) => <button key={t} type="button" onClick={() => add(t)} disabled={full}>+ {t}</button>)}
        </div>
      </section>
      {err ? <p className="ax-err" role="alert">{err}</p> : null}
      <div className="ax-stickybar flat">
        <button type="button" className="ax-btn" onClick={() => { setF(saved); setDraft(''); setErr(''); }} disabled={!dirty && !draft}>Reset</button>
        <button type="submit" className="ax-btn dark" disabled={busy || (!dirty && !draft.trim())}>{busy ? 'Saving…' : 'Save marquee'}</button>
      </div>
    </form>
  );
}

/* ───────────── sale price editor ───────────── */
function PriceEditor({ regular, sale, onChange }) {
  const on = sale !== '';
  const r = Number(regular); const s = Number(sale);
  const valid = on && r > 0 && s >= 1 && s < r;
  const pct = valid ? pctOff(r, s) : 0;
  const save = valid ? r - s : 0;
  const [mode, setMode] = useState('price');
  const [v, setV] = useState(sale);

  const push = (m, val) => { setMode(m); setV(val); onChange(regular, calcSale(regular, m, val)); };
  const toggle = (checked) => { if (!checked) { setV(''); onChange(regular, ''); } else push('percent', '10'); };
  const switchMode = (m) => { setMode(m); setV(m === 'percent' ? String(Math.max(0, pct)) : m === 'amount' ? String(Math.max(0, save)) : String(sale)); };
  const changeRegular = (val) => onChange(val, on ? (mode === 'price' ? sale : calcSale(val, mode, v)) : '');
  const label = mode === 'percent' ? 'Percent off' : mode === 'amount' ? 'Amount off (PKR)' : 'New price (PKR)';

  return (
    <div className="ax-priceed">
      <label className="ax-field">Regular price (PKR)
        <input type="number" inputMode="numeric" min="1" step="1" value={regular} onChange={(e) => changeRegular(e.target.value)} placeholder="e.g. 2000" required />
      </label>
      <label className="ax-switch">
        <input type="checkbox" role="switch" checked={on} onChange={(e) => toggle(e.target.checked)} disabled={!(r > 0)} />
        <span className="track" aria-hidden="true"><i /></span>
        <span><b>Put this watch on sale</b><small>Cross out the regular price and charge a new one</small></span>
      </label>
      {on ? (
        <div className="ax-saleplan">
          <div className="ax-seg" role="group" aria-label="How to set the new price">
            {[['percent', '% off'], ['amount', 'Rs off'], ['price', 'New price']].map(([k, t]) => <button key={k} type="button" className={mode === k ? 'on' : ''} aria-pressed={mode === k} onClick={() => switchMode(k)}>{t}</button>)}
          </div>
          <label className="ax-field">{label}
            <input type="number" inputMode="numeric" min="0" step="1" value={v} onChange={(e) => push(mode, e.target.value)} placeholder={mode === 'percent' ? 'e.g. 25' : mode === 'amount' ? 'e.g. 500' : 'e.g. 1500'} />
          </label>
          <div className="ax-chips" role="group" aria-label="Quick percentages">
            {SALE_CHIPS.map((c) => <button key={c} type="button" className={mode === 'percent' && String(v) === String(c) ? 'on' : ''} onClick={() => push('percent', String(c))}>{c}%</button>)}
          </div>
          <div className={'ax-preview' + (valid ? '' : ' bad')} aria-live="polite">
            {valid ? (
              <>
                <div className="ax-pv"><s>{pkr(r)}</s><b>{pkr(s)}</b><span className="ax-off">−{pct}%</span></div>
                <small>Customers save {pkr(save)}. They pay {pkr(s)} instead of {pkr(r)}.</small>
              </>
            ) : <small>{v === '' ? 'Enter the discount to see the new price.' : 'The sale price must be at least 1 PKR and lower than the regular price.'}</small>}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function QuickSale({ p, busy, onSave, onCancel, onEnd }) {
  const start = onSale(p);
  const [regular, setRegular] = useState(String(regularOf(p) || ''));
  const [sale, setSale] = useState(start ? String(p.price) : '');
  const [err, setErr] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const r = Number(regular); const s = Number(sale);
    if (!Number.isFinite(r) || r < 1) return setErr('Enter a regular price of at least 1 PKR.');
    if (sale === '') return onSave(r, '');
    if (!Number.isFinite(s) || s < 1 || s >= r) return setErr('The sale price must be at least 1 PKR and lower than the regular price.');
    setErr(''); onSave(s, r);
  };
  return (
    <form className="ax-form" onSubmit={submit} noValidate>
      <PriceEditor regular={regular} sale={sale} onChange={(r, s) => { setRegular(r); setSale(s); }} />
      {err ? <p className="ax-err" role="alert">{err}</p> : null}
      <div className="ax-stickybar">
        {onEnd ? <button type="button" className="ax-btn ghost danger ax-left" onClick={onEnd} disabled={busy}>End sale</button> : null}
        <button type="button" className="ax-btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="ax-btn dark" disabled={busy}>{busy ? 'Saving…' : 'Save price'}</button>
      </div>
    </form>
  );
}

function BulkSale({ items, busy, onApply, onCancel }) {
  const [pct, setPct] = useState('10');
  const [step, setStep] = useState('10');
  const n = Number(pct); const st = Number(step);
  const okPct = Number.isFinite(n) && n >= 1 && n <= 90;
  const rows = items.map((p) => { const reg = regularOf(p); const sale = okPct ? roundTo(reg * (1 - n / 100), st) : null; return { p, reg, sale, ok: sale !== null && sale >= 1 && sale < reg }; });
  const count = rows.filter((x) => x.ok).length;
  return (
    <form className="ax-form" onSubmit={(e) => { e.preventDefault(); if (okPct && count) onApply(n, st); }} noValidate>
      <p className="ax-muted">Every selected watch is reduced from its regular price. Watches already on sale are recalculated from the regular price, not the sale price.</p>
      <div className="ax-chips" role="group" aria-label="Quick percentages">
        {SALE_CHIPS.map((c) => <button key={c} type="button" className={String(pct) === String(c) ? 'on' : ''} onClick={() => setPct(String(c))}>{c}%</button>)}
      </div>
      <div className="ax-cols">
        <label className="ax-field">Percent off<input type="number" inputMode="numeric" min="1" max="90" value={pct} onChange={(e) => setPct(e.target.value)} /></label>
        <label className="ax-field">Round prices to<select value={step} onChange={(e) => setStep(e.target.value)}><option value="1">Nearest Rs 1</option><option value="10">Nearest Rs 10</option><option value="50">Nearest Rs 50</option><option value="100">Nearest Rs 100</option></select></label>
      </div>
      {!okPct ? <p className="ax-err" role="alert">Enter a percentage between 1 and 90.</p> : null}
      <section className="ax-block"><h3>Preview</h3>
        <ul className="ax-plain">{rows.slice(0, 6).map(({ p, reg, sale, ok }) => (
          <li key={p.id}><span>{p.name}</span>{ok ? <span className="ax-pv sm"><s>{pkr(reg)}</s><b>{pkr(sale)}</b></span> : <span className="ax-muted">Skipped</span>}</li>
        ))}</ul>
        {rows.length > 6 ? <small className="ax-muted">and {rows.length - 6} more</small> : null}
      </section>
      <div className="ax-stickybar">
        <button type="button" className="ax-btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="ax-btn dark" disabled={busy || !okPct || !count}>{busy ? 'Applying…' : `Apply to ${count} ${count === 1 ? 'watch' : 'watches'}`}</button>
      </div>
    </form>
  );
}

function OrderDetail({ o, busy, onStatus, onSave }) {
  const c = o.customer || {};
  const [carrier, setCarrier] = useState(o.shipping?.carrier || '');
  const [trackingNumber, setTrackingNumber] = useState(o.shipping?.trackingNumber || '');
  const [paymentStatus, setPaymentStatus] = useState(isPaid(o) ? 'paid' : 'pending');
  const fee = o.delivery_fee ?? o.deliveryFee;
  const idx = FLOW.indexOf(o.status);
  const changed = carrier !== (o.shipping?.carrier || '') || trackingNumber !== (o.shipping?.trackingNumber || '') || paymentStatus !== (isPaid(o) ? 'paid' : 'pending');
  return (
    <div className="ax-stack">
      {o.status === 'cancelled' ? <div className="ax-banner bad"><span><b>This order was cancelled.</b></span></div> : (
        <ol className="ax-steps" aria-label="Order progress">{FLOW.map((s, i) => <li key={s} className={i < idx ? 'done' : i === idx ? 'now' : ''} aria-current={i === idx ? 'step' : undefined}><i>{i < idx ? <Icon n="check" size={12} /> : null}</i><span>{s}</span></li>)}</ol>
      )}
      <label className="ax-field">Order status
        <select value={o.status} disabled={busy} onChange={(e) => onStatus(o, e.target.value)}>{(TRANSITIONS[o.status] || [o.status]).map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <small>The customer is emailed when this changes.</small>
      </label>

      <section className="ax-block"><h3>Customer</h3>
        <p><b>{c.name || '—'}</b></p>
        <p className="ax-addr">{[c.address, [c.city, c.postal].filter(Boolean).join(' ')].filter(Boolean).join('\n') || 'No address'}</p>
        <div className="ax-actions">
          {c.phone ? <a className="ax-btn sm" href={phoneHref(c.phone)}>Call {c.phone}</a> : null}
          {c.email ? <a className="ax-btn sm" href={`mailto:${c.email}`}>Email</a> : null}
        </div>
        {c.email ? <small className="ax-break">{c.email}</small> : null}
        {c.notes ? <p className="ax-note"><b>Customer note:</b> {c.notes}</p> : null}
      </section>

      <section className="ax-block"><h3>Items</h3>
        <ul className="ax-plain">{(o.items || []).map((i, k) => <li key={i.id ?? k}><span>{i.name} <small>× {i.qty}</small></span><span>{pkr(Number(i.price || 0) * Number(i.qty || 0))}</span></li>)}</ul>
        <div className="ax-sum">
          {o.promo ? <div><span>Promo {o.promo}</span><span>− {pkr(o.discount)}</span></div> : null}
          {fee !== undefined && fee !== null ? <div><span>Delivery</span><span>{Number(fee) ? pkr(fee) : 'Free'}</span></div> : null}
          <div className="tot"><span>Total</span><span>{pkr(o.total)}</span></div>
        </div>
      </section>

      <section className="ax-block"><h3>Delivery and payment</h3>
        <label className="ax-field">Courier<input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="e.g. TCS, Leopards" /></label>
        <label className="ax-field">Tracking number<input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Consignment number" /></label>
        <label className="ax-field">Cash on delivery
          <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}><option value="pending">Due on delivery</option><option value="paid">Collected</option></select>
        </label>
        <button type="button" className="ax-btn dark" disabled={busy || !changed} onClick={() => onSave({ carrier: carrier.trim(), trackingNumber: trackingNumber.trim(), paymentStatus })}>{busy ? 'Saving…' : 'Save delivery details'}</button>
      </section>
    </div>
  );
}

function ProductForm({ p, busy, onDirty, onUpload, onSave, onCancel, onDelete, onError }) {
  const start = () => ({
    name: p.name || '', brand: p.brand || '', model: p.model || '',
    price: p.price !== undefined && p.price !== null ? String(regularOf(p)) : '',
    sale: onSale(p) ? String(p.price) : '',
    description: p.description || '',
    category: p.category || 'Watches', stock: p.stock || 'unknown', stockQuantity: p.stockQuantity ?? '',
    images: [...(p.images || [])], specs: (p.specs || []).join(', '), featured: !!p.featured, isNew: !!p.isNew,
  });
  const [f, setF] = useState(start);
  const base = useRef(JSON.stringify(f));
  const [err, setErr] = useState('');
  const [upBusy, setUpBusy] = useState(false);
  const [url, setUrl] = useState('');
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  useEffect(() => { onDirty(JSON.stringify(f) !== base.current); }, [f, onDirty]);

  const upload = async (files) => {
    setUpBusy(true);
    try {
      for (const file of files) {
        try { const u = await onUpload(file, p.id); setF((s) => ({ ...s, images: [...s.images, u] })); }
        catch (e) { onError(e.message); }
      }
    } finally { setUpBusy(false); }
  };
  const addUrl = () => {
    const u = url.trim();
    if (!u) return;
    if (!/^(https?:\/\/|\/)/i.test(u)) { setErr('Image links must start with https:// or /'); return; }
    setErr(''); setF((s) => (s.images.includes(u) ? s : { ...s, images: [...s.images, u] })); setUrl('');
  };
  const submit = (e) => {
    e.preventDefault();
    const reg = Number(f.price);
    if (!f.name.trim()) return setErr('Enter a product name.');
    if (!Number.isFinite(reg) || reg < 1) return setErr('Enter a regular price of at least 1 PKR.');
    let price = reg; let originalPrice = '';
    if (f.sale !== '') {
      const s = Number(f.sale);
      if (!Number.isFinite(s) || s < 1) return setErr('Enter the new sale price.');
      if (s >= reg) return setErr('The sale price must be lower than the regular price.');
      price = s; originalPrice = reg;
    }
    if (f.stockQuantity !== '' && (!Number.isFinite(Number(f.stockQuantity)) || Number(f.stockQuantity) < 0)) return setErr('Units in stock must be 0 or more, or left blank.');
    setErr('');
    onSave({
      name: f.name.trim(), brand: f.brand.trim(), model: f.model.trim(),
      price: String(price), originalPrice: originalPrice ? String(originalPrice) : '',
      description: f.description.trim(),
      category: f.category.trim() || 'Watches', stock: f.stock, stockQuantity: String(f.stockQuantity),
      images: f.images, specs: f.specs.split(',').map((s) => s.trim()).filter(Boolean), featured: f.featured, isNew: f.isNew,
    });
  };
  const specList = f.specs.split(',').map((s) => s.trim()).filter(Boolean);
  return (
    <form className="ax-form" onSubmit={submit} noValidate>
      <section className="ax-block"><h3>Basics</h3>
        <label className="ax-field">Name<input value={f.name} onChange={(e) => set('name', e.target.value)} required autoFocus placeholder="e.g. Classic Steel Chronograph" /></label>
        <div className="ax-cols">
          <label className="ax-field">Brand<input value={f.brand} onChange={(e) => set('brand', e.target.value)} /></label>
          <label className="ax-field">Model<input value={f.model} onChange={(e) => set('model', e.target.value)} /></label>
        </div>
        <label className="ax-field">Category<input value={f.category} onChange={(e) => set('category', e.target.value)} /></label>
      </section>

      <section className="ax-block"><h3>Description</h3>
        <label className="ax-field">What should buyers know?
          <textarea rows={6} maxLength={DESC_MAX} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Case size, movement, strap, water resistance, what’s in the box and the warranty." />
          <span className="ax-count"><small>Shown on the product page.</small><small className={f.description.length > DESC_MAX - 60 ? 'warn' : ''}>{f.description.length}/{DESC_MAX}</small></span>
        </label>
      </section>

      <section className="ax-block"><h3>Price and sale</h3>
        <PriceEditor regular={f.price} sale={f.sale} onChange={(r, s) => setF((x) => ({ ...x, price: r, sale: s }))} />
      </section>

      <section className="ax-block"><h3>Stock</h3>
        <div className="ax-cols">
          <label className="ax-field">Availability
            <select value={f.stock} onChange={(e) => set('stock', e.target.value)}><option value="in">In stock</option><option value="out">Out of stock</option><option value="unknown">Confirm on order</option></select>
          </label>
          <label className="ax-field">Units in stock<input type="number" inputMode="numeric" min="0" step="1" value={f.stockQuantity} onChange={(e) => set('stockQuantity', e.target.value)} placeholder="Blank = not tracked" /></label>
        </div>
      </section>

      <section className="ax-block"><h3>Photos</h3>
        {f.images.length ? (
          <ul className="ax-thumbs">{f.images.map((u, i) => (
            <li key={u + i}>
              <img src={u} alt={`Product photo ${i + 1}`} onError={(e) => { e.currentTarget.style.opacity = '.25'; }} />
              {i === 0 ? <Pill tone="info">Cover</Pill> : <button type="button" className="ax-mini-btn" onClick={() => setF((s) => ({ ...s, images: [u, ...s.images.filter((_, k) => k !== i)] }))}>Make cover</button>}
              <button type="button" className="ax-thumbx" aria-label={`Remove photo ${i + 1}`} onClick={() => setF((s) => ({ ...s, images: s.images.filter((_, k) => k !== i) }))}><Icon n="x" size={13} /></button>
            </li>
          ))}</ul>
        ) : <p className="ax-muted">No photos yet. The first photo is the cover.</p>}
        <label className="ax-drop">
          <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" disabled={upBusy} onChange={(e) => { const files = [...e.target.files]; e.target.value = ''; if (files.length) upload(files); }} />
          <Icon n="plus" size={22} /><b>{upBusy ? 'Uploading…' : 'Upload photos'}</b><small>JPG, PNG, WebP or AVIF, up to 4 MB each</small>
        </label>
        <div className="ax-inline"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Or paste an image link" aria-label="Image link" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }} /><button type="button" className="ax-btn" onClick={addUrl}>Add</button></div>
      </section>

      <section className="ax-block"><h3>Details</h3>
        <label className="ax-field">Specs <small>separate with commas</small><input value={f.specs} onChange={(e) => set('specs', e.target.value)} placeholder="Quartz, 42 mm, Water resistant" /></label>
        {specList.length ? <ul className="ax-specs">{specList.map((s, i) => <li key={s + i}>{s}</li>)}</ul> : null}
        <div className="ax-checks">
          <label><input type="checkbox" checked={f.featured} onChange={(e) => set('featured', e.target.checked)} />Featured on the store</label>
          <label><input type="checkbox" checked={f.isNew} onChange={(e) => set('isNew', e.target.checked)} />Show “New” label</label>
        </div>
      </section>

      {err ? <p className="ax-err" role="alert">{err}</p> : null}
      <div className="ax-stickybar">
        {onDelete ? <button type="button" className="ax-btn ghost danger ax-left" onClick={onDelete} disabled={busy}>Delete</button> : null}
        <button type="button" className="ax-btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="ax-btn dark" disabled={busy || upBusy}>{busy ? 'Saving…' : p.id ? 'Save changes' : 'Add product'}</button>
      </div>
    </form>
  );
}

function PromoForm({ p, busy, onDirty, onSave, onCancel }) {
  const editing = !!p;
  const [f, setF] = useState(() => ({ code: p?.code || '', type: p?.type || 'percent', value: p?.value ?? '', min: p?.min || 0, max: p?.max || 0, active: p ? !!p.active : true }));
  const base = useRef(JSON.stringify(f));
  const [err, setErr] = useState('');
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  useEffect(() => { onDirty(JSON.stringify(f) !== base.current); }, [f, onDirty]);
  const submit = (e) => {
    e.preventDefault();
    const code = f.code.trim().toUpperCase();
    const value = Number(f.value);
    if (!/^[A-Z0-9_-]{3,24}$/.test(code)) return setErr('Use 3 to 24 letters, numbers, dashes or underscores for the code.');
    if (!Number.isFinite(value) || value < 1) return setErr('Enter a discount value of at least 1.');
    if (f.type === 'percent' && value > 100) return setErr('A percentage discount can’t be more than 100.');
    if (Number(f.min) < 0 || Number(f.max) < 0) return setErr('Minimum order and max uses can’t be negative.');
    setErr('');
    onSave({ code, type: f.type, value: String(f.value), min: String(f.min || 0), max: String(f.max || 0), active: f.active });
  };
  return (
    <form className="ax-form" onSubmit={submit} noValidate>
      <label className="ax-field">Code<input value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} readOnly={editing} required autoFocus={!editing} className="ax-upper" placeholder="EID10" />{editing ? <small>A code can’t be renamed. Create a new one instead.</small> : null}</label>
      <div className="ax-cols">
        <label className="ax-field">Discount type<select value={f.type} onChange={(e) => set('type', e.target.value)}><option value="percent">Percent off</option><option value="fixed">Fixed amount off (PKR)</option></select></label>
        <label className="ax-field">{f.type === 'percent' ? 'Percent (1–100)' : 'Amount (PKR)'}<input type="number" inputMode="numeric" min="1" max={f.type === 'percent' ? 100 : undefined} value={f.value} onChange={(e) => set('value', e.target.value)} required /></label>
      </div>
      <div className="ax-cols">
        <label className="ax-field">Minimum order (PKR)<input type="number" inputMode="numeric" min="0" value={f.min} onChange={(e) => set('min', e.target.value)} /></label>
        <label className="ax-field">Max uses<input type="number" inputMode="numeric" min="0" value={f.max} onChange={(e) => set('max', e.target.value)} /><small>0 means unlimited</small></label>
      </div>
      <div className="ax-checks"><label><input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} />Active, customers can use this code</label></div>
      {err ? <p className="ax-err" role="alert">{err}</p> : null}
      <div className="ax-stickybar">
        <button type="button" className="ax-btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="ax-btn dark" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create code'}</button>
      </div>
    </form>
  );
}

function SettingsForm({ initial, busy, onSave }) {
  const [fee, setFee] = useState(String(initial));
  useEffect(() => { setFee(String(initial)); }, [initial]);
  return (
    <form className="ax-form" onSubmit={(e) => { e.preventDefault(); if (fee === '' || Number(fee) < 0) return; onSave(fee); }}>
      <label className="ax-field">Delivery charge (PKR)<input type="number" inputMode="numeric" min="0" step="1" value={fee} onChange={(e) => setFee(e.target.value)} required /><small>Enter 0 for free delivery.</small></label>
      <div><button className="ax-btn dark" disabled={busy || String(initial) === fee}>{busy ? 'Saving…' : 'Save settings'}</button></div>
    </form>
  );
}

function Login({ onLogin, notify, toast }) {
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Login failed. Check your password and try again.');
      onLogin(j.token);
    } catch (x) { setErr(x.message); notify(x.message, 'error'); setBusy(false); }
  };
  return (
    <div className="ax ax-center">
      <div className="ax-login">
        <div className="ax-lside" aria-hidden="true">
          <span className="ax-logo">WF</span>
          <p>Time well sold.<small>Orders, watches and prices, all in one place.</small></p>
        </div>
        <form className="ax-lform" onSubmit={submit}>
          <h1>Welcome back</h1>
          <p className="ax-muted">Log in to manage Watch Flex PK.</p>
          <label className="ax-field" htmlFor="admin-password">Admin password
            <span className="ax-pw">
              <input id="admin-password" type={show ? 'text' : 'password'} autoComplete="current-password" required autoFocus value={pw} onChange={(e) => setPw(e.target.value)} aria-invalid={!!err} />
              <button type="button" className="ax-mini-btn" onClick={() => setShow((s) => !s)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
            </span>
          </label>
          {err ? <p className="ax-err" role="alert">{err}</p> : null}
          <button className="ax-btn dark wide" disabled={busy || !pw}>{busy ? 'Logging in…' : 'Log in'}</button>
        </form>
      </div>
      <Toast t={toast} />
    </div>
  );
}