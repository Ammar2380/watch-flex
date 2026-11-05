'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pkr } from '@/lib/site';
import './admin.css';

/* ───────────── constants & helpers ───────────── */
const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const FLOW = ['pending', 'confirmed', 'shipped', 'delivered'];
const TRANSITIONS = { pending: ['pending', 'confirmed', 'cancelled'], confirmed: ['confirmed', 'shipped', 'cancelled'], shipped: ['shipped', 'delivered'], delivered: ['delivered'], cancelled: ['cancelled'] };
const NEXT = { pending: ['confirmed', 'Confirm'], confirmed: ['shipped', 'Mark shipped'], shipped: ['delivered', 'Mark delivered'] };
const TABS = [['dash', 'Dashboard', 'Home'], ['orders', 'Orders', 'Orders'], ['products', 'Products', 'Products'], ['promos', 'Promo codes', 'Promos'], ['cust', 'Customers', 'Customers'], ['settings', 'Settings', 'Settings']];
const SIZES = [10, 25, 50];
const MAX_IMAGE = 4 * 1024 * 1024;

const when = (d) => { const x = new Date(d); return Number.isFinite(x.getTime()) ? x.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; };
const day = (d) => { const x = new Date(d); return Number.isFinite(x.getTime()) ? x.toLocaleDateString('en-GB', { dateStyle: 'medium' }) : '—'; };
const isPaid = (o) => o.payment_status === 'paid' || o.paymentStatus === 'paid';
const qtyOf = (p) => (p.stockQuantity === null || p.stockQuantity === undefined || p.stockQuantity === '' ? null : Number(p.stockQuantity));
const isLow = (p) => p.stock === 'out' || (qtyOf(p) !== null && qtyOf(p) <= 5);
const stockLabel = (p) => (p.stock === 'out' ? 'Out of stock' : qtyOf(p) !== null && qtyOf(p) <= 5 ? 'Low stock' : p.stock === 'in' ? 'In stock' : 'Confirm on order');
const stockTone = (p) => (p.stock === 'out' ? 'bad' : qtyOf(p) !== null && qtyOf(p) <= 5 ? 'warn' : p.stock === 'in' ? 'info' : 'mute');
const delta = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
const pageNums = (pg, pages) => {
  const a = [...new Set([1, pages, pg - 1, pg, pg + 1])].filter((n) => n >= 1 && n <= pages).sort((x, y) => x - y);
  const out = [];
  a.forEach((n, i) => { if (i && n - a[i - 1] > 1) out.push('…' + n); out.push(n); });
  return out;
};

const Badge = ({ s }) => <span className={'wf-pill s-' + s}>{s}</span>;
const Pill = ({ tone, children }) => <span className={'wf-pill ' + tone}>{children}</span>;

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
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [sel, setSel] = useState(() => new Set());
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
    setTab(k); setQ(''); setSf(''); setPage(1); setSel(new Set()); setDrawer(null);
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
  const deleteProducts = (items) => setAsk({
    title: items.length === 1 ? `Delete “${items[0].name}”?` : `Delete ${items.length} products?`,
    body: 'They will disappear from your store. Past orders keep their details.', confirm: 'Delete', danger: true,
    action: async () => {
      await run(async () => {
        let done = 0;
        try { for (const p of items) { await api('/api/admin/products/' + encodeURIComponent(p.id), 'DELETE'); done++; } }
        catch (e) { await load().catch(() => {}); throw new Error(`Deleted ${done} of ${items.length}. ${e.message}`); }
        return done;
      }, (n) => (n === 1 ? 'Product deleted' : `${n} products deleted`));
      setSel(new Set());
    },
  });

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
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), orders: 0, sales: 0, collected: 0 });
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
      months, top: [...best.values()].sort((a, b) => b.units - a.units).slice(0, 5),
    };
  }, [D, orders]);

  /* ───── guards ───── */
  if (T === null) return <div className="wf wf-center" aria-live="polite"><p>Loading admin…</p></div>;
  if (!T) return <Login onLogin={(t) => { try { sessionStorage.setItem('adm', t); } catch {} setT(t); }} notify={notify} toast={toastMsg} />;
  if (!D) return (
    <div className="wf wf-center" aria-busy={!loadError}>
      <h1 className="wf-ctitle">Watch Flex PK</h1>
      {loadError ? (
        <>
          <p className="wf-err" role="alert">Couldn’t load your store data: {loadError}</p>
          <div className="wf-actions">
            <button className="wf-btn dark" type="button" onClick={() => { setLoadError(''); load().catch((x) => { setLoadError(x.message); notify(x.message, 'error'); }); }}>Try again</button>
            <button className="wf-btn" type="button" onClick={logout}>Log out</button>
          </div>
        </>
      ) : <p role="status">Loading your store data…</p>}
      <Toast t={toastMsg} />
    </div>
  );

  /* ───── shared pieces ───── */
  const openOrder = drawer?.type === 'order' ? orders.find((o) => o.ref === drawer.ref) : null;
  const current = TABS.find((t) => t[0] === tab) || TABS[0];

  const paged = (list) => {
    const pages = Math.max(1, Math.ceil(list.length / size));
    const pg = Math.min(page, pages);
    return { rows: list.slice((pg - 1) * size, pg * size), pg, pages, total: list.length };
  };
  const pager = (p) => !p.total ? null : (
    <div className="wf-pager">
      <label>Rows per page
        <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }}>{SIZES.map((n) => <option key={n} value={n}>{n}</option>)}</select>
      </label>
      <span className="wf-range">{(p.pg - 1) * size + 1}–{Math.min(p.pg * size, p.total)} of {p.total}</span>
      <div className="wf-pages" role="navigation" aria-label="Pagination">
        <button type="button" disabled={p.pg <= 1} onClick={() => setPage(p.pg - 1)} aria-label="Previous page">‹</button>
        {pageNums(p.pg, p.pages).map((n) => (typeof n === 'string' ? <span key={n}>…</span> : <button key={n} type="button" className={n === p.pg ? 'on' : ''} aria-current={n === p.pg ? 'page' : undefined} onClick={() => setPage(n)}>{n}</button>))}
        <button type="button" disabled={p.pg >= p.pages} onClick={() => setPage(p.pg + 1)} aria-label="Next page">›</button>
      </div>
    </div>
  );

  const ordersTable = (list, compact) => !list.length ? <Empty title="No orders here" body="When customers place orders they will show up in this table." /> : (
    <div className="wf-tablewrap">
      <table className="wf-tbl">
        <thead><tr><th>Order</th>{compact ? null : <th>Date</th>}<th>Customer</th><th>Total</th>{compact ? null : <th>Payment</th>}<th>Status</th>{compact ? null : <th><span className="wf-sr">Next step</span></th>}</tr></thead>
        <tbody>{list.map((o) => {
          const c = o.customer || {};
          const next = NEXT[o.status];
          return (
            <tr key={o.ref} className="click" onClick={() => openDrawer({ type: 'order', ref: o.ref })}>
              <td data-label="Order"><button type="button" className="wf-ref" onClick={(e) => { e.stopPropagation(); openDrawer({ type: 'order', ref: o.ref }); }}>{o.ref}</button></td>
              {compact ? null : <td data-label="Date">{day(o.date)}</td>}
              <td data-label="Customer"><b>{c.name || 'Unknown customer'}</b><small>{c.city || '—'}</small></td>
              <td data-label="Total">{pkr(o.total)}</td>
              {compact ? null : <td data-label="Payment"><span className={isPaid(o) ? 'wf-ok' : 'wf-due'}>{isPaid(o) ? 'Collected' : 'Due on delivery'}</span></td>}
              <td data-label="Status"><Badge s={o.status} /></td>
              {compact ? null : <td className="act">{next ? <button type="button" className="wf-btn sm" disabled={busy} onClick={(e) => { e.stopPropagation(); changeStatus(o, next[0]); }}>{next[1]}</button> : null}</td>}
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );

  const stat = (label, value, sub, tone) => <div className="wf-stat"><span>{label}</span><b>{value}</b>{sub ? <small className={tone || ''}>{sub}</small> : null}</div>;
  const dl = (cur, prev) => { const d = delta(cur, prev); return d === null ? 'No data last month' : `${d >= 0 ? '▲' : '▼'} ${Math.abs(d)}% vs last month`; };

  /* ───── views ───── */
  const dash = () => {
    const cur = stats.months[5], prev = stats.months[4];
    return (
      <>
        {stats.pending > 0 && (
          <div className="wf-banner" role="status">
            <span><b>{stats.pending} {stats.pending === 1 ? 'order is' : 'orders are'} waiting for confirmation.</b> Customers hear from you once you confirm.</span>
            <button type="button" className="wf-btn sm" onClick={() => { go('orders'); setSf('pending'); }}>Review orders</button>
          </div>
        )}
        <div className="wf-stats">
          {stat('Total orders', orders.length, `${cur.orders} this month`)}
          {stat('Order value', pkr(stats.value), dl(cur.sales, prev.sales), delta(cur.sales, prev.sales) === null ? '' : delta(cur.sales, prev.sales) >= 0 ? 'up' : 'down')}
          {stat('Cash collected', pkr(stats.collected), 'Cash on delivery')}
          {stat('Still due on delivery', pkr(stats.outstanding), 'Not yet collected')}
        </div>
        <div className="wf-stats">
          {stat('Pending orders', stats.pending, 'Need confirming')}
          {stat('Customers', customers.length, 'With an email address')}
          {stat('Products', D.products.length, `${stats.out} out of stock`)}
          {stat('Active promo codes', (D.promos || []).filter((p) => p.active).length, `${(D.promos || []).length} in total`)}
        </div>
        <div className="wf-two">
          <section className="wf-card">
            <h2>Sales by month</h2>
            <div className="wf-tablewrap"><table className="wf-tbl plain">
              <thead><tr><th>Month</th><th>Orders</th><th>Order value</th><th>Collected</th></tr></thead>
              <tbody>{[...stats.months].reverse().map((m) => <tr key={m.key}><td data-label="Month">{m.label}</td><td data-label="Orders">{m.orders}</td><td data-label="Order value">{pkr(m.sales)}</td><td data-label="Collected">{pkr(m.collected)}</td></tr>)}</tbody>
            </table></div>
          </section>
          <section className="wf-card">
            <h2>Best sellers</h2>
            {!stats.top.length ? <p className="wf-muted">No sales yet.</p> : (
              <div className="wf-tablewrap"><table className="wf-tbl plain">
                <thead><tr><th>Product</th><th>Units</th><th>Sales</th></tr></thead>
                <tbody>{stats.top.map((p) => <tr key={p.id}><td data-label="Product">{p.name}</td><td data-label="Units">{p.units}</td><td data-label="Sales">{pkr(p.sales)}</td></tr>)}</tbody>
              </table></div>
            )}
          </section>
        </div>
        <div className="wf-two">
          <section className="wf-card">
            <h2>Stock to watch</h2>
            {!stats.low.length ? <p className="wf-muted">Everything is stocked.</p> : (
              <div className="wf-tablewrap"><table className="wf-tbl plain">
                <thead><tr><th>Product</th><th>Status</th><th>Units left</th></tr></thead>
                <tbody>{stats.low.slice(0, 8).map((p) => <tr key={p.id}><td data-label="Product">{p.name}</td><td data-label="Status"><Pill tone={stockTone(p)}>{stockLabel(p)}</Pill></td><td data-label="Units left">{qtyOf(p) ?? '—'}</td></tr>)}</tbody>
              </table></div>
            )}
          </section>
          <section className="wf-card">
            <div className="wf-cardhead"><h2>Latest orders</h2><button type="button" className="wf-linkbtn" onClick={() => go('orders')}>View all</button></div>
            {ordersTable(orders.slice(0, 5), true)}
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
    const p = paged(l);
    return (
      <>
        <div className="wf-tabs" role="group" aria-label="Filter orders by status">
          <button type="button" className={!sf ? 'on' : ''} aria-pressed={!sf} onClick={() => { setSf(''); setPage(1); }}>All <i>{orders.length}</i></button>
          {STATUSES.map((s) => <button key={s} type="button" className={sf === s ? 'on' : ''} aria-pressed={sf === s} onClick={() => { setSf(s); setPage(1); }}>{s} <i>{counts[s]}</i></button>)}
        </div>
        <div className="wf-toolbar">
          <Search value={q} onChange={(v) => { setQ(v); setPage(1); }} label="Search orders by number, name, phone, email or city" placeholder="Search order, name, phone, email" />
          <span className="wf-hint">Changing a status emails the customer.</span>
        </div>
        {ordersTable(p.rows)}
        {pager(p)}
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
        <div className="wf-toolbar">
          <Search value={q} onChange={(v) => { setQ(v); setPage(1); }} label="Search products" placeholder="Search products" />
        </div>
        {!l.length ? <Empty title={D.products.length ? 'No products match your search' : 'No products yet'} body={D.products.length ? 'Try a different name, brand or model.' : 'Add your first watch to start selling.'} action={!D.products.length && <button type="button" className="wf-btn dark" onClick={() => openDrawer({ type: 'product', item: null })}>Add product</button>} /> : (
          <div className="wf-tablewrap">
            <table className="wf-tbl">
              <thead><tr>
                <th className="chk"><input type="checkbox" checked={allOn} onChange={() => setSel((s) => { const n = new Set(s); p.rows.forEach((x) => (allOn ? n.delete(x.id) : n.add(x.id))); return n; })} aria-label="Select all products on this page" /></th>
                <th>Product</th><th>Price</th><th>Units</th><th>Status</th><th>Labels</th><th><span className="wf-sr">Actions</span></th>
              </tr></thead>
              <tbody>{p.rows.map((x) => (
                <tr key={x.id} className={'click' + (sel.has(x.id) ? ' picked' : '')} onClick={() => openDrawer({ type: 'product', item: x })}>
                  <td className="chk" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(x.id)} onChange={() => toggle(x.id)} aria-label={`Select ${x.name}`} /></td>
                  <td data-label="Product"><div className="wf-pname">{x.images?.[0] ? <img src={x.images[0]} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /> : <span className="wf-noimg" />}<span><b>{x.name}</b><small>{[x.brand, x.model].filter(Boolean).join(' ') || x.category}</small></span></div></td>
                  <td data-label="Price">{pkr(x.price)}</td>
                  <td data-label="Units">{qtyOf(x) ?? '—'}</td>
                  <td data-label="Status"><Pill tone={stockTone(x)}>{stockLabel(x)}</Pill></td>
                  <td data-label="Labels">{[x.featured ? 'Featured' : '', x.isNew ? 'New' : ''].filter(Boolean).join(', ') || '—'}</td>
                  <td className="act"><button type="button" className="wf-btn sm" aria-label={`Edit ${x.name}`} onClick={(e) => { e.stopPropagation(); openDrawer({ type: 'product', item: x }); }}>Edit</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {pager(p)}
        {selected.length ? (
          <div className="wf-bulk" role="region" aria-label="Bulk actions">
            <span>{selected.length} selected</span>
            <button type="button" className="wf-btn sm danger" onClick={() => deleteProducts(selected)}>Delete</button>
            <button type="button" className="wf-btn sm" onClick={() => setSel(new Set())} aria-label="Clear selection">Clear</button>
          </div>
        ) : null}
      </>
    );
  };

  const promosView = () => {
    const p = paged(D.promos || []);
    return (
      <>
        {!p.total ? <Empty title="No promo codes yet" body="Create a code to run a sale or reward repeat customers." action={<button type="button" className="wf-btn dark" onClick={() => openDrawer({ type: 'promo', item: null })}>New promo code</button>} /> : (
          <div className="wf-tablewrap">
            <table className="wf-tbl">
              <thead><tr><th>Code</th><th>Discount</th><th>Minimum order</th><th>Used</th><th>Status</th><th><span className="wf-sr">Actions</span></th></tr></thead>
              <tbody>{p.rows.map((x) => (
                <tr key={x.code} className="click" onClick={() => openDrawer({ type: 'promo', item: x })}>
                  <td data-label="Code"><b className="wf-code">{x.code}</b></td>
                  <td data-label="Discount">{x.type === 'percent' ? `${x.value}% off` : `${pkr(x.value)} off`}</td>
                  <td data-label="Minimum order">{Number(x.min) ? pkr(x.min) : 'None'}</td>
                  <td data-label="Used">{Number(x.used || 0)}{Number(x.max) ? ` of ${x.max}` : ' (no limit)'}</td>
                  <td data-label="Status"><Pill tone={x.active ? 'ok' : 'mute'}>{x.active ? 'Active' : 'Off'}</Pill></td>
                  <td className="act">
                    <button type="button" className="wf-btn sm" aria-label={`Edit promo ${x.code}`} onClick={(e) => { e.stopPropagation(); openDrawer({ type: 'promo', item: x }); }}>Edit</button>
                    <button type="button" className="wf-btn sm danger" aria-label={`Delete promo ${x.code}`} onClick={(e) => { e.stopPropagation(); setAsk({ title: `Delete code ${x.code}?`, body: 'Customers will no longer be able to use it.', confirm: 'Delete code', danger: true, action: () => run(() => api('/api/admin/promos/' + encodeURIComponent(x.code), 'DELETE'), 'Promo code deleted') }); }}>Delete</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {pager(p)}
      </>
    );
  };

  const custView = () => {
    const term = q.trim().toLowerCase();
    const l = customers.filter((c) => !term || [c.name, c.email, c.phone, c.city].some((v) => String(v || '').toLowerCase().includes(term)));
    const p = paged(l);
    return (
      <>
        <div className="wf-toolbar"><Search value={q} onChange={(v) => { setQ(v); setPage(1); }} label="Search customers" placeholder="Search name, email, phone, city" /></div>
        {!l.length ? <Empty title={customers.length ? 'No customers match your search' : 'No customers yet'} body={customers.length ? 'Try a different name or email.' : 'Customers appear here after their first order.'} /> : (
          <div className="wf-tablewrap">
            <table className="wf-tbl">
              <thead><tr><th>Customer</th><th>Contact</th><th>City</th><th>Orders</th><th>Spent</th><th>Last order</th></tr></thead>
              <tbody>{p.rows.map((c) => (
                <tr key={c.email}>
                  <td data-label="Customer"><b>{c.name || 'Unnamed customer'}</b></td>
                  <td data-label="Contact"><a href={`mailto:${c.email}`}>{c.email}</a>{c.phone ? <small><a href={`tel:${String(c.phone).replace(/[^\d+]/g, '')}`}>{c.phone}</a></small> : null}</td>
                  <td data-label="City">{c.city || '—'}</td>
                  <td data-label="Orders">{c.n}</td>
                  <td data-label="Spent">{pkr(c.spent)}</td>
                  <td data-label="Last order">{day(c.last)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {pager(p)}
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
        <div className="wf-gap"><button type="button" className="wf-btn" onClick={checkHealth} disabled={health === 'loading'}>{health === 'loading' ? 'Testing…' : 'Test connections'}</button></div>
        {health && health !== 'loading' ? (
          <div className="wf-tablewrap"><table className="wf-tbl plain"><tbody>{Object.entries(health).map(([k, v]) => {
            const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
            const good = /^(ok|connected|configured|true|ready|healthy)/i.test(s);
            return <tr key={k}><td data-label="Service" className="cap">{k.replaceAll('_', ' ')}</td><td data-label="Result"><Pill tone={good ? 'ok' : /^(false|missing|error|fail)/i.test(s) ? 'bad' : 'mute'}>{s}</Pill></td></tr>;
          })}</tbody></table></div>
        ) : null}
      </section>
    </div>
  );

  const views = { dash, orders: ordersView, products: productsView, promos: promosView, cust: custView, settings: settingsView };
  const headAction = tab === 'orders' ? <button type="button" className="wf-btn" onClick={exportCsv} disabled={!orders.length}>Export CSV</button>
    : tab === 'products' ? <button type="button" className="wf-btn dark" onClick={() => openDrawer({ type: 'product', item: null })}>+ Add product</button>
    : tab === 'promos' ? <button type="button" className="wf-btn dark" onClick={() => openDrawer({ type: 'promo', item: null })}>+ New promo code</button> : null;

  return (
    <div className="wf">
      <div className="wf-shell">
        <aside className="wf-side">
          <div className="wf-brand"><span className="wf-logo" aria-hidden="true">WF</span><span><b>Watch Flex PK</b><small>Store admin</small></span></div>
          <nav aria-label="Admin sections" className="wf-nav">
            <p className="wf-navlabel">Menu</p>
            {TABS.map((t) => (
              <button key={t[0]} type="button" className={tab === t[0] ? 'on' : ''} aria-current={tab === t[0] ? 'page' : undefined} onClick={() => go(t[0])}>
                <span className="full">{t[1]}</span><span className="short">{t[2]}</span>
                {t[0] === 'orders' && stats.pending ? <em aria-label={`${stats.pending} pending`}>{stats.pending}</em> : null}
              </button>
            ))}
          </nav>
          <button type="button" className="wf-logout" onClick={logout}>Log out</button>
        </aside>
        <div className="wf-panel">
          <div className="wf-mtop"><b>Watch Flex PK</b><button type="button" className="wf-btn sm" onClick={logout}>Log out</button></div>
          <header className="wf-head">
            <h1>{current[1]}</h1>
            <div className="wf-actions">
              <button type="button" className="wf-btn" onClick={refresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
              {headAction}
            </div>
          </header>
          <main className="wf-main" key={tab}>{views[tab]()}</main>
        </div>
      </div>

      {drawer?.type === 'order' ? (
        <Drawer title={openOrder ? `Order ${openOrder.ref}` : 'Order not found'} sub={openOrder ? when(openOrder.date) : ''} onClose={closeDrawer}>
          {openOrder ? <OrderDetail key={openOrder.ref} o={openOrder} busy={busy} onStatus={changeStatus} onSave={(body) => putOrder(openOrder.ref, body, (r) => (r?.notification === 'failed' ? 'Saved, but the customer email failed' : r?.notification === 'sent' ? 'Saved and customer emailed' : 'Delivery details saved'))} /> : <p className="wf-muted">This order is no longer in your list. Refresh and try again.</p>}
        </Drawer>
      ) : null}
      {drawer?.type === 'product' ? (
        <Drawer title={drawer.item ? 'Edit product' : 'Add product'} sub={drawer.item?.name} onClose={closeDrawer}>
          <ProductForm key={drawer.item?.id || 'new'} p={drawer.item || {}} busy={busy} onDirty={(v) => { dirtyRef.current = v; }} onUpload={uploadFile} onCancel={closeDrawer}
            onDelete={drawer.item ? () => deleteProducts([drawer.item]) : null}
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
      {t ? <div key={t.id} className={'wf-toast ' + t.kind} role={t.kind === 'error' ? 'alert' : undefined}>{t.text}</div> : null}
    </div>
  );
}
function Search({ value, onChange, label, placeholder }) {
  return (
    <label className="wf-search"><span className="wf-sr">{label}</span>
      <input type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function Empty({ title, body, action }) {
  return <div className="wf-empty"><h3>{title}</h3><p>{body}</p>{action || null}</div>;
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
        <div className="wf-dhead"><div><h2>{title}</h2>{sub ? <small>{sub}</small> : null}</div><button type="button" className="wf-x" onClick={() => closeRef.current()} aria-label="Close">×</button></div>
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
          <button type="button" className={'wf-btn ' + (danger ? 'solid-danger' : 'dark')} onClick={onConfirm}>{confirm}</button>
        </div>
      </div>
    </div>
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
      {o.status === 'cancelled' ? <div className="wf-banner bad"><span><b>This order was cancelled.</b></span></div> : (
        <ol className="wf-steps" aria-label="Order progress">{FLOW.map((s, i) => <li key={s} className={i < idx ? 'done' : i === idx ? 'now' : ''} aria-current={i === idx ? 'step' : undefined}><i>{i < idx ? '✓' : ''}</i><span>{s}</span></li>)}</ol>
      )}
      <label className="wf-field">Order status
        <select value={o.status} disabled={busy} onChange={(e) => onStatus(o, e.target.value)}>{(TRANSITIONS[o.status] || [o.status]).map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <small>The customer is emailed when this changes.</small>
      </label>

      <section className="wf-block"><h3>Customer</h3>
        <p><b>{c.name || '—'}</b></p>
        <p className="wf-addr">{[c.address, [c.city, c.postal].filter(Boolean).join(' ')].filter(Boolean).join('\n') || 'No address'}</p>
        <div className="wf-actions">
          {c.phone ? <a className="wf-btn sm" href={`tel:${String(c.phone).replace(/[^\d+]/g, '')}`}>Call {c.phone}</a> : null}
          {c.email ? <a className="wf-btn sm" href={`mailto:${c.email}`}>Email</a> : null}
        </div>
        {c.email ? <small>{c.email}</small> : null}
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
        <button type="button" className="wf-btn dark" disabled={busy || !changed} onClick={() => onSave({ carrier: carrier.trim(), trackingNumber: trackingNumber.trim(), paymentStatus })}>{busy ? 'Saving…' : 'Save delivery details'}</button>
      </section>
    </div>
  );
}

function ProductForm({ p, busy, onDirty, onUpload, onSave, onCancel, onDelete, onError }) {
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
    if (f.stockQuantity !== '' && (!Number.isFinite(Number(f.stockQuantity)) || Number(f.stockQuantity) < 0)) return setErr('Units in stock must be 0 or more, or left blank.');
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
              {i === 0 ? <Pill tone="info">Cover</Pill> : <button type="button" className="wf-mini" onClick={() => setF((s) => ({ ...s, images: [u, ...s.images.filter((_, k) => k !== i)] }))}>Make cover</button>}
              <button type="button" className="wf-thumbx" aria-label={`Remove photo ${i + 1}`} onClick={() => setF((s) => ({ ...s, images: s.images.filter((_, k) => k !== i) }))}>×</button>
            </li>
          ))}</ul>
        ) : <p className="wf-muted">No photos yet. The first photo is the cover.</p>}
        <label className="wf-drop">
          <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" disabled={upBusy} onChange={(e) => { const files = [...e.target.files]; e.target.value = ''; if (files.length) upload(files); }} />
          <b>{upBusy ? 'Uploading…' : 'Upload photos'}</b><small>JPG, PNG, WebP or AVIF, up to 4 MB each</small>
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
        {onDelete ? <button type="button" className="wf-btn danger wf-left" onClick={onDelete} disabled={busy}>Delete</button> : null}
        <button type="button" className="wf-btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="wf-btn dark" disabled={busy || upBusy}>{busy ? 'Saving…' : p.id ? 'Save changes' : 'Add product'}</button>
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
        <button type="submit" className="wf-btn dark" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create code'}</button>
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
      <div><button className="wf-btn dark" disabled={busy || String(initial) === fee}>{busy ? 'Saving…' : 'Save settings'}</button></div>
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
    <div className="wf wf-center">
      <form className="wf-login" onSubmit={submit}>
        <h1>Watch Flex PK</h1>
        <p className="wf-muted">Log in to manage your store.</p>
        <label className="wf-field" htmlFor="admin-password">Admin password
          <span className="wf-pw">
            <input id="admin-password" type={show ? 'text' : 'password'} autoComplete="current-password" required autoFocus value={pw} onChange={(e) => setPw(e.target.value)} aria-invalid={!!err} />
            <button type="button" className="wf-mini" onClick={() => setShow((s) => !s)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
          </span>
        </label>
        {err ? <p className="wf-err" role="alert">{err}</p> : null}
        <button className="wf-btn dark wide" disabled={busy || !pw}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <Toast t={toast} />
    </div>
  );
}