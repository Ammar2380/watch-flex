'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pkr } from '@/lib/site';
import './admin.css';

/* ───────────── constants & helpers ───────────── */
const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const FLOW = ['pending', 'confirmed', 'shipped', 'delivered'];
const TRANSITIONS = { pending: ['pending', 'confirmed', 'cancelled'], confirmed: ['confirmed', 'shipped', 'cancelled'], shipped: ['shipped', 'delivered'], delivered: ['delivered'], cancelled: ['cancelled'] };
const NEXT = { pending: ['confirmed', 'Confirm order'], confirmed: ['shipped', 'Mark shipped'], shipped: ['delivered', 'Mark delivered'] };
const TABS = [['dash', 'Dashboard', 'Home'], ['orders', 'Orders', 'Orders'], ['products', 'Products', 'Watches'], ['promos', 'Promo codes', 'Promos'], ['cust', 'Customers', 'People'], ['settings', 'Store settings', 'Settings']];
const ICON_KEY = { dash: 'dash', orders: 'orders', products: 'watch', promos: 'tag', cust: 'users', settings: 'sliders' };
const PAGE = 25;
const MAX_IMAGE = 4 * 1024 * 1024;

const when = (d) => { const x = new Date(d); return Number.isFinite(x.getTime()) ? x.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; };
const day = (d) => { const x = new Date(d); return Number.isFinite(x.getTime()) ? x.toLocaleDateString('en-GB', { dateStyle: 'medium' }) : '—'; };
const isPaid = (o) => o.payment_status === 'paid' || o.paymentStatus === 'paid';
const qtyOf = (p) => (p.stockQuantity === null || p.stockQuantity === undefined || p.stockQuantity === '' ? null : Number(p.stockQuantity));
const isLow = (p) => p.stock === 'out' || (qtyOf(p) !== null && qtyOf(p) <= 5);
const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || '?';
const stockLabel = (p) => (p.stock === 'out' ? 'Out of stock' : qtyOf(p) !== null && qtyOf(p) <= 5 ? `Only ${qtyOf(p)} left` : p.stock === 'in' ? 'In stock' : 'Confirm on order');
const stockTone = (p) => (p.stock === 'out' ? 'bad' : qtyOf(p) !== null && qtyOf(p) <= 5 ? 'warn' : p.stock === 'in' ? 'ok' : 'mute');

const ICONS = {
  dash: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  orders: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
  watch: <><circle cx="12" cy="12" r="5.5" /><path d="M9 6.5L10 3h4l1 3.5M9 17.5L10 21h4l1-3.5M12 9.5V12l1.8 1.2" /></>,
  tag: <><path d="M3 12l9-9h8v8l-9 9z" /><circle cx="16" cy="8" r="1.2" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.5 3-6 6-6s6 2.5 6 6M16 5a3 3 0 010 6M18 14c2 .8 3 3 3 6" /></>,
  sliders: <><path d="M4 7h8M18 7h2M4 17h2M12 17h8" /><circle cx="15" cy="7" r="2.2" /><circle cx="9" cy="17" r="2.2" /></>,
  out: <path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.2-4.2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  refresh: <path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7" />,
  download: <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  alert: <><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.01" /></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
};
function Icon({ n, size = 20 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{ICONS[n]}</svg>;
}
function Brand({ small }) {
  return (
    <div className={'wf-brand' + (small ? ' sm' : '')}>
      <svg viewBox="0 0 40 40" width={small ? 28 : 36} height={small ? 28 : 36} aria-hidden="true">
        <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="2" />
        {Array.from({ length: 12 }, (_, i) => <line key={i} x1="20" y1="5" x2="20" y2={i % 3 === 0 ? 9 : 7.5} stroke="currentColor" strokeWidth="1.5" transform={`rotate(${i * 30} 20 20)`} />)}
        <path d="M20 20V11M20 20l6 3" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
      <span><b>Watch Flex PK</b><small>Store admin</small></span>
    </div>
  );
}
const Badge = ({ s }) => <span className={'wf-badge s-' + s}>{s}</span>;

/* ───────────── root ───────────── */
export default function AdminApp() {
  const [T, setT] = useState(null); // null = not read yet, '' = logged out
  const [D, setD] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('dash');
  const [drawer, setDrawer] = useState(null); // {type:'order'|'product'|'promo', ref?, item?}
  const [ask, setAsk] = useState(null);
  const [q, setQ] = useState('');
  const [sf, setSf] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [toastMsg, setToastMsg] = useState(null);
  const [health, setHealth] = useState(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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
    const h = window.location.hash.slice(1);
    if (TABS.some((x) => x[0] === h)) setTab(h);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const logout = useCallback(() => { try { sessionStorage.removeItem('adm'); } catch {} setT(''); setD(null); setDrawer(null); setAsk(null); setHealth(null); }, []);
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
      try { await load(); } catch { notify('Saved, but the list could not refresh. Use the refresh button.', 'error'); }
      return true;
    } catch (x) { notify(x.message, 'error'); return false; } finally { setBusy(false); }
  };

  const go = (k) => {
    setTab(k); setQ(''); setSf(''); setLimit(PAGE); setDrawer(null);
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

  /* derived data (hooks must run before any early return) */
  const orders = useMemo(() => [...(D?.orders || [])].sort((a, b) => new Date(b.date) - new Date(a.date)), [D]);
  const customers = useMemo(() => {
    const m = {};
    orders.forEach((o) => {
      const c0 = o.customer || {};
      const email = String(c0.email || '').trim().toLowerCase();
      if (!email) return;
      const c = m[email] || (m[email] = { ...c0, email, n: 0, spent: 0, last: o.date });
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
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-GB', { month: 'short' }), orders: 0, sales: 0, collected: 0 });
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
      live, collected, outstanding, value: collected + outstanding,
      rate: collected + outstanding > 0 ? collected / (collected + outstanding) : 0,
      pending: orders.filter((o) => o.status === 'pending').length,
      low: products.filter(isLow), out: products.filter((p) => p.stock === 'out').length,
      months, top: [...best.values()].sort((a, b) => b.units - a.units).slice(0, 5),
    };
  }, [D, orders]);

  /* ───── guards ───── */
  if (T === null) return <div className="wf wf-center" aria-live="polite"><div className="wf-spin" /><p>Loading admin…</p></div>;
  if (!T) return <Login onLogin={(t) => { try { sessionStorage.setItem('adm', t); } catch {} setT(t); }} notify={notify} toast={toastMsg} />;
  if (!D) return (
    <div className="wf wf-center" aria-busy={!loadError}>
      <Brand />
      {loadError ? (
        <>
          <p className="wf-err" role="alert">Couldn’t load your store data: {loadError}</p>
          <div className="wf-actions">
            <button className="wf-btn pri" type="button" onClick={() => { setLoadError(''); load().catch((x) => { setLoadError(x.message); notify(x.message, 'error'); }); }}>Try again</button>
            <button className="wf-btn" type="button" onClick={logout}>Log out</button>
          </div>
        </>
      ) : (<><div className="wf-spin" /><p role="status">Loading your store data…</p></>)}
      <Toast t={toastMsg} />
    </div>
  );

  /* ───── views ───── */
  const pendingBadge = stats.pending;
  const openOrder = drawer?.type === 'order' ? orders.find((o) => o.ref === drawer.ref) : null;

  const orderList = (list, more) => !list.length ? <Empty icon="orders" title="No orders here" body="When customers place orders they will show up in this list." /> : (
    <>
      <div className="wf-list" role="list">
        {list.map((o) => <OrderRow key={o.ref} o={o} busy={busy} onOpen={(ref) => openDrawer({ type: 'order', ref })} onAdvance={changeStatus} />)}
      </div>
      {more}
    </>
  );

  const dash = () => {
    const maxSales = Math.max(1, ...stats.months.map((m) => m.sales));
    const maxUnits = Math.max(1, ...stats.top.map((p) => p.units));
    return (
      <>
        {stats.pending > 0 && (
          <div className="wf-alert" role="status">
            <Icon n="alert" />
            <span><b>{stats.pending} {stats.pending === 1 ? 'order is' : 'orders are'} waiting for confirmation.</b> Customers hear from you once you confirm.</span>
            <button type="button" className="wf-btn sm" onClick={() => { go('orders'); setSf('pending'); }}>Review</button>
          </div>
        )}
        <div className="wf-dash">
          <section className="wf-card wf-dialcard" aria-label="Cash on delivery collection">
            <h2>Cash collected</h2>
            <Dial rate={stats.rate} />
            <dl className="wf-dl">
              <div><dt><i className="dot gold" />Collected</dt><dd>{pkr(stats.collected)}</dd></div>
              <div><dt><i className="dot" />Still due on delivery</dt><dd>{pkr(stats.outstanding)}</dd></div>
            </dl>
          </section>
          <div className="wf-kpis">
            <Kpi label="Total orders" value={orders.length} />
            <Kpi label="Pending orders" value={stats.pending} tone={stats.pending ? 'warn' : ''} />
            <Kpi label="Order value (not cancelled)" value={pkr(stats.value)} />
            <Kpi label="Customers" value={customers.length} />
            <Kpi label={`Products (${stats.out} out of stock)`} value={D.products.length} />
            <Kpi label="Active promo codes" value={(D.promos || []).filter((p) => p.active).length} />
          </div>
        </div>

        <div className="wf-two">
          <section className="wf-card">
            <h2>Last 6 months</h2>
            <div className="wf-bars" role="list">
              {stats.months.map((m) => (
                <div key={m.key} className="wf-bar" role="listitem" aria-label={`${m.label}: ${m.orders} orders, ${pkr(m.sales)} order value, ${pkr(m.collected)} collected`} title={`${m.orders} orders · ${pkr(m.sales)}`}>
                  <span className="wf-bar-n">{m.orders}</span>
                  <div className="wf-bar-track"><div className="wf-bar-fill" style={{ height: `${(m.sales / maxSales) * 100}%` }}><div className="wf-bar-got" style={{ height: m.sales ? `${(m.collected / m.sales) * 100}%` : 0 }} /></div></div>
                  <span className="wf-bar-l">{m.label}</span>
                </div>
              ))}
            </div>
            <p className="wf-legend"><i className="dot gold" />Collected <i className="dot" />Order value · number on top is orders</p>
          </section>
          <section className="wf-card">
            <h2>Best sellers</h2>
            {!stats.top.length ? <p className="wf-muted">No sales yet.</p> : (
              <ol className="wf-top">{stats.top.map((p) => (
                <li key={p.id}><div><b>{p.name}</b><small>{p.units} sold</small></div><div className="wf-meter"><i style={{ width: `${(p.units / maxUnits) * 100}%` }} /></div><span>{pkr(p.sales)}</span></li>
              ))}</ol>
            )}
          </section>
        </div>

        <div className="wf-two">
          <section className="wf-card">
            <h2>Stock to watch</h2>
            {!stats.low.length ? <p className="wf-muted">Everything is stocked.</p> : (
              <ul className="wf-plain">{stats.low.slice(0, 8).map((p) => (
                <li key={p.id}><span>{p.name}</span><span className={'wf-pill ' + stockTone(p)}>{stockLabel(p)}</span></li>
              ))}</ul>
            )}
          </section>
          <section className="wf-card">
            <div className="wf-cardhead"><h2>Latest orders</h2><button type="button" className="wf-link" onClick={() => go('orders')}>See all orders</button></div>
            {orderList(orders.slice(0, 5))}
          </section>
        </div>
      </>
    );
  };

  const exportCsv = () => {
    const risky = (t) => /^[=@\t\r]/.test(t) || /^[+-](?![\d\s()-]+$)/.test(t);
    const cell = (v) => { let t = String(v ?? ''); if (typeof v !== 'number' && risky(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
    const head = ['Order', 'Date', 'Name', 'Email', 'Phone', 'City', 'Address', 'Items', 'Promo', 'Discount', 'Delivery fee', 'Total', 'Payment', 'Payment status', 'Courier', 'Tracking number', 'Status'];
    const rows = orders.map((o) => { const c = o.customer || {}; return [o.ref, o.date, c.name, c.email, c.phone, c.city, c.address, (o.items || []).map((i) => i.name + ' x' + i.qty).join('; '), o.promo, o.discount, o.delivery_fee ?? o.deliveryFee ?? 0, o.total, o.payment || 'Cash on delivery', o.payment_status || o.paymentStatus || 'pending', o.shipping?.carrier || '', o.shipping?.trackingNumber || '', o.status]; });
    const blob = new Blob(['\uFEFF' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'watch-flex-orders.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    return (
      <>
        <div className="wf-toolbar">
          <Search value={q} onChange={(v) => { setQ(v); setLimit(PAGE); }} label="Search orders by number, name, phone, email or city" placeholder="Search order, name, phone, email" />
          <button type="button" className="wf-btn" onClick={exportCsv} disabled={!orders.length}><Icon n="download" size={18} />Export CSV</button>
        </div>
        <div className="wf-chips" role="group" aria-label="Filter orders by status">
          <button type="button" className={'wf-chip' + (!sf ? ' on' : '')} aria-pressed={!sf} onClick={() => { setSf(''); setLimit(PAGE); }}>All <b>{orders.length}</b></button>
          {STATUSES.map((s) => <button key={s} type="button" className={'wf-chip' + (sf === s ? ' on' : '')} aria-pressed={sf === s} onClick={() => { setSf(s); setLimit(PAGE); }}>{s} <b>{counts[s]}</b></button>)}
        </div>
        <p className="wf-hint">Changing an order’s status emails the customer automatically.</p>
        {orderList(l.slice(0, limit), l.length > limit ? <button type="button" className="wf-btn wf-more" onClick={() => setLimit((n) => n + PAGE)}>Show {Math.min(PAGE, l.length - limit)} more ({l.length - limit} left)</button> : null)}
      </>
    );
  };

  const productsView = () => {
    const term = q.trim().toLowerCase();
    const l = D.products.filter((p) => !term || [p.name, p.brand, p.model, p.category].some((v) => String(v || '').toLowerCase().includes(term)));
    return (
      <>
        <div className="wf-toolbar">
          <Search value={q} onChange={setQ} label="Search products" placeholder="Search products" />
          <button type="button" className="wf-btn pri" onClick={() => openDrawer({ type: 'product', item: null })}><Icon n="plus" size={18} />Add product</button>
        </div>
        {!l.length ? <Empty icon="watch" title={D.products.length ? 'No products match your search' : 'No products yet'} body={D.products.length ? 'Try a different name, brand or model.' : 'Add your first watch to start selling.'} action={!D.products.length && <button type="button" className="wf-btn pri" onClick={() => openDrawer({ type: 'product', item: null })}>Add product</button>} /> : (
          <div className="wf-grid">{l.map((p) => (
            <article key={p.id} className="wf-pcard">
              <div className="wf-pimg">
                {p.images?.[0] ? <img src={p.images[0]} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /> : <Icon n="watch" size={40} />}
                <div className="wf-ptags">{p.featured ? <span className="wf-pill gold">Featured</span> : null}{p.isNew ? <span className="wf-pill info">New</span> : null}</div>
              </div>
              <div className="wf-pbody">
                <div><b>{p.name}</b><small>{[p.brand, p.model].filter(Boolean).join(' ') || p.category}</small></div>
                <div className="wf-prow"><span className="wf-price">{pkr(p.price)}</span><span className={'wf-pill ' + stockTone(p)}>{stockLabel(p)}</span></div>
                <div className="wf-prow">
                  <button type="button" className="wf-btn sm" aria-label={`Edit ${p.name}`} onClick={() => openDrawer({ type: 'product', item: p })}>Edit</button>
                  <button type="button" className="wf-btn sm danger" aria-label={`Delete ${p.name}`} onClick={() => setAsk({ title: `Delete “${p.name}”?`, body: 'It will disappear from your store. Past orders keep their details.', confirm: 'Delete product', danger: true, action: () => run(() => api('/api/admin/products/' + encodeURIComponent(p.id), 'DELETE'), 'Product deleted') })}>Delete</button>
                </div>
              </div>
            </article>
          ))}</div>
        )}
      </>
    );
  };

  const promosView = () => (
    <>
      <div className="wf-toolbar">
        <p className="wf-muted wf-grow">Discount codes customers can enter at checkout.</p>
        <button type="button" className="wf-btn pri" onClick={() => openDrawer({ type: 'promo', item: null })}><Icon n="plus" size={18} />New promo code</button>
      </div>
      {!(D.promos || []).length ? <Empty icon="tag" title="No promo codes yet" body="Create a code to run a sale or reward repeat customers." action={<button type="button" className="wf-btn pri" onClick={() => openDrawer({ type: 'promo', item: null })}>Create promo code</button>} /> : (
        <div className="wf-grid sm">{D.promos.map((x) => {
          const used = Number(x.used || 0), max = Number(x.max || 0);
          return (
            <article key={x.code} className={'wf-promo' + (x.active ? '' : ' off')}>
              <div className="wf-prow"><b className="wf-code">{x.code}</b><span className={'wf-pill ' + (x.active ? 'ok' : 'mute')}>{x.active ? 'Active' : 'Off'}</span></div>
              <p className="wf-off">{x.type === 'percent' ? `${x.value}% off` : `${pkr(x.value)} off`}</p>
              <small>{Number(x.min) ? `On orders over ${pkr(x.min)}` : 'No minimum order'}</small>
              <div className="wf-meter" aria-hidden="true"><i style={{ width: max ? `${Math.min(100, (used / max) * 100)}%` : '0%' }} /></div>
              <small>{max ? `${used} of ${max} uses` : `${used} uses, unlimited`}</small>
              <div className="wf-prow">
                <button type="button" className="wf-btn sm" aria-label={`Edit promo ${x.code}`} onClick={() => openDrawer({ type: 'promo', item: x })}>Edit</button>
                <button type="button" className="wf-btn sm danger" aria-label={`Delete promo ${x.code}`} onClick={() => setAsk({ title: `Delete code ${x.code}?`, body: 'Customers will no longer be able to use it.', confirm: 'Delete code', danger: true, action: () => run(() => api('/api/admin/promos/' + encodeURIComponent(x.code), 'DELETE'), 'Promo code deleted') })}>Delete</button>
              </div>
            </article>
          );
        })}</div>
      )}
    </>
  );

  const custView = () => {
    const term = q.trim().toLowerCase();
    const l = customers.filter((c) => !term || [c.name, c.email, c.phone, c.city].some((v) => String(v || '').toLowerCase().includes(term)));
    return (
      <>
        <div className="wf-toolbar"><Search value={q} onChange={(v) => { setQ(v); setLimit(PAGE); }} label="Search customers" placeholder="Search name, email, phone, city" /></div>
        {!l.length ? <Empty icon="users" title={customers.length ? 'No customers match your search' : 'No customers yet'} body={customers.length ? 'Try a different name or email.' : 'Customers appear here after their first order.'} /> : (
          <>
            <div className="wf-list">
              {l.slice(0, limit).map((c) => (
                <article key={c.email} className="wf-row wf-crow">
                  <span className="wf-avatar" aria-hidden="true">{initials(c.name)}</span>
                  <span className="wf-who"><b>{c.name || 'Unnamed customer'}</b><small>{c.city || '—'}</small></span>
                  <span className="wf-contact"><a href={`mailto:${c.email}`}>{c.email}</a>{c.phone ? <a href={`tel:${String(c.phone).replace(/[^\d+]/g, '')}`}>{c.phone}</a> : null}</span>
                  <span className="wf-amt">{pkr(c.spent)}<small>{c.n} {c.n === 1 ? 'order' : 'orders'}, last {day(c.last)}</small></span>
                </article>
              ))}
            </div>
            {l.length > limit ? <button type="button" className="wf-btn wf-more" onClick={() => setLimit((n) => n + PAGE)}>Show more</button> : null}
          </>
        )}
      </>
    );
  };

  const settingsView = () => (
    <div className="wf-two">
      <section className="wf-card">
        <h2>Delivery</h2>
        <SettingsForm initial={D.settings?.delivery_fee ?? 0} busy={busy} onSave={(fee) => run(() => api('/api/admin/settings', 'PUT', { delivery_fee: fee }), 'Store settings saved')} />
      </section>
      <section className="wf-card">
        <h2>Service connections</h2>
        <p className="wf-muted">Checks the services set up on your server. Secret values are never shown.</p>
        <button type="button" className="wf-btn" onClick={checkHealth} disabled={health === 'loading'}>{health === 'loading' ? 'Testing…' : 'Test connections'}</button>
        {health && health !== 'loading' ? (
          <ul className="wf-plain wf-health">{Object.entries(health).map(([k, v]) => {
            const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
            const good = /^(ok|connected|configured|true|ready|healthy)/i.test(s);
            return <li key={k}><span>{k.replaceAll('_', ' ')}</span><span className={'wf-pill ' + (good ? 'ok' : /^(false|missing|error|fail)/i.test(s) ? 'bad' : 'mute')}>{s}</span></li>;
          })}</ul>
        ) : null}
      </section>
    </div>
  );

  const views = { dash, orders: ordersView, products: productsView, promos: promosView, cust: custView, settings: settingsView };
  const current = TABS.find((t) => t[0] === tab) || TABS[0];

  return (
    <div className="wf">
      <div className="wf-shell">
        <aside className="wf-side">
          <Brand />
          <nav aria-label="Admin sections" className="wf-nav">
            {TABS.map((t) => (
              <button key={t[0]} type="button" className={tab === t[0] ? 'on' : ''} aria-current={tab === t[0] ? 'page' : undefined} onClick={() => go(t[0])}>
                <span className="wf-ico"><Icon n={ICON_KEY[t[0]]} />{t[0] === 'orders' && pendingBadge ? <i className="wf-dot" aria-hidden="true" /> : null}</span>
                <span className="wf-lab"><span className="full">{t[1]}</span><span className="short">{t[2]}</span></span>
                {t[0] === 'orders' && pendingBadge ? <em className="wf-count" aria-label={`${pendingBadge} pending`}>{pendingBadge}</em> : null}
              </button>
            ))}
          </nav>
          <button type="button" className="wf-logout" onClick={logout}><Icon n="out" />Log out</button>
        </aside>
        <div className="wf-content">
          <header className="wf-head">
            <div className="wf-mbrand"><Brand small /></div>
            <h1>{current[1]}</h1>
            <div className="wf-actions">
              <button type="button" className={'wf-iconbtn' + (refreshing ? ' spin' : '')} onClick={refresh} disabled={refreshing} aria-label="Refresh store data" title="Refresh"><Icon n="refresh" /></button>
              <button type="button" className="wf-iconbtn wf-mlogout" onClick={logout} aria-label="Log out" title="Log out"><Icon n="out" /></button>
            </div>
          </header>
          <main className="wf-main" key={tab}>{views[tab]()}</main>
        </div>
      </div>

      {openOrder || (drawer?.type === 'order') ? (
        <Drawer title={openOrder ? `Order ${openOrder.ref}` : 'Order not found'} sub={openOrder ? when(openOrder.date) : ''} onClose={closeDrawer}>
          {openOrder ? <OrderDetail key={openOrder.ref} o={openOrder} busy={busy} onStatus={changeStatus} onSave={(body) => putOrder(openOrder.ref, body, (r) => (r?.notification === 'failed' ? 'Saved, but the customer email failed' : r?.notification === 'sent' ? 'Saved and customer emailed' : 'Delivery details saved'))} /> : <p className="wf-muted">This order is no longer in your list. Refresh and try again.</p>}
        </Drawer>
      ) : null}
      {drawer?.type === 'product' ? (
        <Drawer title={drawer.item ? 'Edit product' : 'Add product'} sub={drawer.item?.name} onClose={closeDrawer}>
          <ProductForm key={drawer.item?.id || 'new'} p={drawer.item || {}} busy={busy} onDirty={(v) => { dirtyRef.current = v; }} onUpload={uploadFile} onCancel={closeDrawer}
            onSave={async (payload) => { if (await run(() => api('/api/admin/products', 'POST', { ...payload, id: drawer.item?.id }), 'Product saved')) { dirtyRef.current = false; setDrawer(null); } }} onError={(m) => notify(m, 'error')} />
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
function Toast({ t }) {
  return (
    <div className="wf-toasts" aria-live="polite" role="status">
      {t ? <div key={t.id} className={'wf-toast ' + t.kind} role={t.kind === 'error' ? 'alert' : undefined}><Icon n={t.kind === 'error' ? 'alert' : 'check'} size={18} />{t.text}</div> : null}
    </div>
  );
}
function Kpi({ label, value, tone }) {
  return <div className={'wf-kpi ' + (tone || '')}><b>{value}</b><span>{label}</span></div>;
}
function Search({ value, onChange, label, placeholder }) {
  return (
    <label className="wf-search"><Icon n="search" size={18} /><span className="wf-sr">{label}</span>
      <input type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function Empty({ icon, title, body, action }) {
  return <div className="wf-empty"><Icon n={icon} size={34} /><h3>{title}</h3><p>{body}</p>{action || null}</div>;
}
function Dial({ rate }) {
  const filled = Math.round(rate * 60);
  const pct = Math.round(rate * 100);
  return (
    <figure className="wf-dial" aria-label={`${pct}% of order value collected`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="57" className="bezel" />
        {Array.from({ length: 60 }, (_, i) => <line key={i} x1="60" y1="7" x2="60" y2={i % 5 === 0 ? 19 : 14} transform={`rotate(${i * 6} 60 60)`} className={i < filled ? 'tick on' : 'tick'} />)}
      </svg>
      <figcaption><b>{pct}%</b><span>collected</span></figcaption>
    </figure>
  );
}
function Drawer({ title, sub, onClose, children }) {
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement;
    const key = (e) => { if (e.key === 'Escape' && !document.querySelector('.wf-modal')) closeRef.current(); };
    document.addEventListener('keydown', key);
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = old; prev?.focus?.(); };
  }, []);
  return (
    <div className="wf-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeRef.current(); }}>
      <div className="wf-drawer" role="dialog" aria-modal="true" aria-label={title} ref={panel} tabIndex={-1}>
        <div className="wf-dhead"><div><h2>{title}</h2>{sub ? <small>{sub}</small> : null}</div><button type="button" className="wf-iconbtn" onClick={() => closeRef.current()} aria-label="Close"><Icon n="close" /></button></div>
        <div className="wf-dbody">{children}</div>
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
    <div className="wf-overlay wf-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="wf-dialog" role="alertdialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2><p>{body}</p>
        <div className="wf-actions end">
          <button type="button" className="wf-btn" ref={ref} onClick={onClose}>{cancel}</button>
          <button type="button" className={'wf-btn ' + (danger ? 'solid-danger' : 'pri')} onClick={onConfirm}>{confirm}</button>
        </div>
      </div>
    </div>
  );
}

function OrderRow({ o, busy, onOpen, onAdvance }) {
  const next = NEXT[o.status];
  const paid = isPaid(o);
  const c = o.customer || {};
  return (
    <article className="wf-row wf-orow" role="listitem">
      <button type="button" className="wf-rowmain" onClick={() => onOpen(o.ref)} aria-label={`Open order ${o.ref} for ${c.name || 'customer'}`}>
        <span className="wf-ref">{o.ref}</span>
        <span className="wf-who"><b>{c.name || 'Unknown customer'}</b><small>{c.city || '—'}</small></span>
        <span className="wf-date">{day(o.date)}</span>
        <span className="wf-amt">{pkr(o.total)}<small className={paid ? 'ok' : 'due'}>{paid ? 'Collected' : 'Due on delivery'}</small></span>
        <Badge s={o.status} />
      </button>
      {next ? <button type="button" className="wf-btn sm" disabled={busy} onClick={() => onAdvance(o, next[0])}>{next[1]}</button> : <span className="wf-nospace" />}
    </article>
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
    <div className="wf-stack">
      {o.status === 'cancelled' ? <div className="wf-alert bad"><Icon n="alert" /><span><b>This order was cancelled.</b></span></div> : (
        <ol className="wf-steps" aria-label="Order progress">{FLOW.map((s, i) => <li key={s} className={i < idx ? 'done' : i === idx ? 'now' : ''} aria-current={i === idx ? 'step' : undefined}><i>{i < idx ? <Icon n="check" size={14} /> : null}</i><span>{s}</span></li>)}</ol>
      )}
      <label className="wf-field">Order status
        <select value={o.status} disabled={busy} onChange={(e) => onStatus(o, e.target.value)}>{(TRANSITIONS[o.status] || [o.status]).map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <small>The customer is emailed when this changes.</small>
      </label>

      <section className="wf-block"><h3>Customer</h3>
        <p><b>{c.name || '—'}</b></p>
        <p className="wf-addr">{[c.address, [c.city, c.postal].filter(Boolean).join(' ')].filter(Boolean).join('\n') || 'No address'}</p>
        <div className="wf-actions">
          {c.phone ? <a className="wf-btn sm" href={`tel:${String(c.phone).replace(/[^\d+]/g, '')}`}><Icon n="phone" size={16} />{c.phone}</a> : null}
          {c.email ? <a className="wf-btn sm" href={`mailto:${c.email}`}><Icon n="mail" size={16} />{c.email}</a> : null}
        </div>
        {c.notes ? <p className="wf-note"><b>Customer note:</b> {c.notes}</p> : null}
      </section>

      <section className="wf-block"><h3>Items</h3>
        <ul className="wf-plain">{(o.items || []).map((i, k) => <li key={i.id ?? k}><span>{i.name} <small>× {i.qty}</small></span><span>{pkr(Number(i.price || 0) * Number(i.qty || 0))}</span></li>)}</ul>
        <div className="wf-sum">
          {o.promo ? <div><span>Promo {o.promo}</span><span>− {pkr(o.discount)}</span></div> : null}
          {fee !== undefined && fee !== null ? <div><span>Delivery</span><span>{Number(fee) ? pkr(fee) : 'Free'}</span></div> : null}
          <div className="tot"><span>Total</span><span>{pkr(o.total)}</span></div>
        </div>
      </section>

      <section className="wf-block"><h3>Delivery and payment</h3>
        <label className="wf-field">Courier<input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="e.g. TCS, Leopards" /></label>
        <label className="wf-field">Tracking number<input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Consignment number" /></label>
        <label className="wf-field">Cash on delivery
          <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}><option value="pending">Due on delivery</option><option value="paid">Collected</option></select>
        </label>
        <button type="button" className="wf-btn pri" disabled={busy || !changed} onClick={() => onSave({ carrier: carrier.trim(), trackingNumber: trackingNumber.trim(), paymentStatus })}>{busy ? 'Saving…' : 'Save delivery details'}</button>
      </section>
    </div>
  );
}

function ProductForm({ p, busy, onDirty, onUpload, onSave, onCancel, onError }) {
  const start = () => ({ name: p.name || '', brand: p.brand || '', model: p.model || '', price: p.price ?? '', category: p.category || 'Watches', stock: p.stock || 'unknown', stockQuantity: p.stockQuantity ?? '', images: [...(p.images || [])], specs: (p.specs || []).join(', '), featured: !!p.featured, isNew: !!p.isNew });
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
    const price = Number(f.price);
    if (!f.name.trim()) return setErr('Enter a product name.');
    if (!Number.isFinite(price) || price < 1) return setErr('Enter a price of at least 1 PKR.');
    if (f.stockQuantity !== '' && (!Number.isFinite(Number(f.stockQuantity)) || Number(f.stockQuantity) < 0)) return setErr('Stock quantity must be 0 or more, or left blank.');
    setErr('');
    onSave({ name: f.name.trim(), brand: f.brand.trim(), model: f.model.trim(), price: String(f.price), category: f.category.trim() || 'Watches', stock: f.stock, stockQuantity: String(f.stockQuantity), images: f.images, specs: f.specs.split(',').map((s) => s.trim()).filter(Boolean), featured: f.featured, isNew: f.isNew });
  };
  return (
    <form className="wf-form" onSubmit={submit} noValidate>
      <label className="wf-field">Name<input value={f.name} onChange={(e) => set('name', e.target.value)} required autoFocus /></label>
      <div className="wf-cols">
        <label className="wf-field">Brand<input value={f.brand} onChange={(e) => set('brand', e.target.value)} /></label>
        <label className="wf-field">Model<input value={f.model} onChange={(e) => set('model', e.target.value)} /></label>
      </div>
      <div className="wf-cols">
        <label className="wf-field">Price (PKR)<input type="number" inputMode="numeric" min="1" step="1" value={f.price} onChange={(e) => set('price', e.target.value)} required /></label>
        <label className="wf-field">Category<input value={f.category} onChange={(e) => set('category', e.target.value)} /></label>
      </div>
      <div className="wf-cols">
        <label className="wf-field">Availability
          <select value={f.stock} onChange={(e) => set('stock', e.target.value)}><option value="in">In stock</option><option value="out">Out of stock</option><option value="unknown">Confirm on order</option></select>
        </label>
        <label className="wf-field">Units in stock<input type="number" inputMode="numeric" min="0" step="1" value={f.stockQuantity} onChange={(e) => set('stockQuantity', e.target.value)} placeholder="Blank = not tracked" /></label>
      </div>

      <fieldset className="wf-block"><legend>Photos</legend>
        {f.images.length ? (
          <ul className="wf-thumbs">{f.images.map((u, i) => (
            <li key={u + i}>
              <img src={u} alt={`Product photo ${i + 1}`} onError={(e) => { e.currentTarget.style.opacity = '.25'; }} />
              {i === 0 ? <span className="wf-pill gold">Cover</span> : <button type="button" className="wf-mini" onClick={() => setF((s) => ({ ...s, images: [u, ...s.images.filter((_, k) => k !== i)] }))}>Make cover</button>}
              <button type="button" className="wf-x" aria-label={`Remove photo ${i + 1}`} onClick={() => setF((s) => ({ ...s, images: s.images.filter((_, k) => k !== i) }))}><Icon n="close" size={14} /></button>
            </li>
          ))}</ul>
        ) : <p className="wf-muted">No photos yet. The first photo is the cover.</p>}
        <label className="wf-drop">
          <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" disabled={upBusy} onChange={(e) => { const files = [...e.target.files]; e.target.value = ''; if (files.length) upload(files); }} />
          <Icon n="plus" size={18} />{upBusy ? 'Uploading…' : 'Upload photos'}<small>JPG, PNG, WebP or AVIF, up to 4 MB each</small>
        </label>
        <div className="wf-inline"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Or paste an image link" aria-label="Image link" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }} /><button type="button" className="wf-btn" onClick={addUrl}>Add</button></div>
      </fieldset>

      <label className="wf-field">Specs <small>separate with commas</small><input value={f.specs} onChange={(e) => set('specs', e.target.value)} placeholder="Quartz, 42 mm, Water resistant" /></label>
      <div className="wf-checks">
        <label><input type="checkbox" checked={f.featured} onChange={(e) => set('featured', e.target.checked)} />Featured on the store</label>
        <label><input type="checkbox" checked={f.isNew} onChange={(e) => set('isNew', e.target.checked)} />Show “New” label</label>
      </div>
      {err ? <p className="wf-err" role="alert">{err}</p> : null}
      <div className="wf-stickybar">
        <button type="button" className="wf-btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="wf-btn pri" disabled={busy || upBusy}>{busy ? 'Saving…' : p.id ? 'Save changes' : 'Add product'}</button>
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
    <form className="wf-form" onSubmit={submit} noValidate>
      <label className="wf-field">Code<input value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} readOnly={editing} required autoFocus={!editing} className="wf-upper" placeholder="EID10" />{editing ? <small>A code can’t be renamed. Create a new one instead.</small> : null}</label>
      <div className="wf-cols">
        <label className="wf-field">Discount type<select value={f.type} onChange={(e) => set('type', e.target.value)}><option value="percent">Percent off</option><option value="fixed">Fixed amount off (PKR)</option></select></label>
        <label className="wf-field">{f.type === 'percent' ? 'Percent (1–100)' : 'Amount (PKR)'}<input type="number" inputMode="numeric" min="1" max={f.type === 'percent' ? 100 : undefined} value={f.value} onChange={(e) => set('value', e.target.value)} required /></label>
      </div>
      <div className="wf-cols">
        <label className="wf-field">Minimum order (PKR)<input type="number" inputMode="numeric" min="0" value={f.min} onChange={(e) => set('min', e.target.value)} /></label>
        <label className="wf-field">Max uses<input type="number" inputMode="numeric" min="0" value={f.max} onChange={(e) => set('max', e.target.value)} /><small>0 means unlimited</small></label>
      </div>
      <div className="wf-checks"><label><input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} />Active, customers can use this code</label></div>
      {err ? <p className="wf-err" role="alert">{err}</p> : null}
      <div className="wf-stickybar">
        <button type="button" className="wf-btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="wf-btn pri" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create code'}</button>
      </div>
    </form>
  );
}

function SettingsForm({ initial, busy, onSave }) {
  const [fee, setFee] = useState(String(initial));
  useEffect(() => { setFee(String(initial)); }, [initial]);
  return (
    <form className="wf-form" onSubmit={(e) => { e.preventDefault(); if (fee === '' || Number(fee) < 0) return; onSave(fee); }}>
      <label className="wf-field">Delivery charge (PKR)<input type="number" inputMode="numeric" min="0" step="1" value={fee} onChange={(e) => setFee(e.target.value)} required /><small>Enter 0 for free delivery.</small></label>
      <button className="wf-btn pri" disabled={busy || String(initial) === fee}>{busy ? 'Saving…' : 'Save settings'}</button>
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
    <div className="wf wf-center wf-loginbg">
      <form className="wf-login" onSubmit={submit}>
        <Brand />
        <h1>Welcome back</h1>
        <label className="wf-field" htmlFor="admin-password">Admin password
          <span className="wf-pw">
            <input id="admin-password" type={show ? 'text' : 'password'} autoComplete="current-password" required autoFocus value={pw} onChange={(e) => setPw(e.target.value)} aria-invalid={!!err} />
            <button type="button" className="wf-mini" onClick={() => setShow((s) => !s)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
          </span>
        </label>
        {err ? <p className="wf-err" role="alert">{err}</p> : null}
        <button className="wf-btn pri wide" disabled={busy || !pw}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <Toast t={toast} />
    </div>
  );
}