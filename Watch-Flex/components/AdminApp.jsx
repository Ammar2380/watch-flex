'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pkr } from '@/lib/site';

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const TABS = [['dash', 'Dashboard'], ['orders', 'Orders'], ['products', 'Products'], ['promos', 'Promo codes'], ['cust', 'Customers'], ['settings', 'Store settings']];
const when = (d) => new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export default function AdminApp() {
  const [T, setT] = useState(null); // null = not read yet, '' = logged out
  const [D, setD] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('dash');
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState('');
  const [sf, setSf] = useState('');
  const [msg, setMsg] = useState('');
  const [health, setHealth] = useState(null);
  const [imageBusy, setImageBusy] = useState(false);
  const imagesRef = useRef(null);
  const timer = useRef(0);
  const toast = useCallback((t) => { setMsg(t); clearTimeout(timer.current); timer.current = setTimeout(() => setMsg(''), 3200); }, []);

  useEffect(() => { setT(sessionStorage.getItem('adm') || ''); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const logout = useCallback(() => { sessionStorage.removeItem('adm'); setT(''); setD(null); }, []);
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
    if (T && !D) load().catch((x) => { setLoadError(x.message); toast(x.message); });
  }, [T, D, load, toast]);

  const run = async (f, ok) => {
    try { const result = await f(); toast(typeof ok === 'function' ? ok(result) : ok); setEdit(null); await load(); } catch (x) { toast(x.message); }
  };
  const uploadImage = async (file) => {
    if (!file) return;
    setImageBusy(true);
    try {
      const form = new FormData(); form.append('file', file); form.append('productId', edit?.id || 'new-product');
      const r = await fetch('/api/admin/images', { method: 'POST', headers: { 'x-admin-token': T || '' }, body: form });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Image upload failed.');
      if (imagesRef.current) imagesRef.current.value = [imagesRef.current.value.trim(), j.url].filter(Boolean).join('\n');
      toast('Image uploaded to permanent product storage');
    } catch (error) { toast(error.message); }
    finally { setImageBusy(false); }
  };
  const checkHealth = async () => { try { setHealth(await api('/api/admin/health')); } catch (error) { toast(error.message); } }; 

  const customers = useMemo(() => {
    const m = {};
    (D?.orders || []).forEach((o) => {
      const customer = o.customer || {};
      const email = String(customer.email || '').toLowerCase();
      if (!email) return;
      const c = m[email] || (m[email] = { ...customer, n: 0, spent: 0, last: o.date });
      c.n++;
      if (o.payment_status === 'paid' || o.paymentStatus === 'paid') c.spent += Number(o.total || 0);
      if (o.date > c.last) c.last = o.date;
    });
    return Object.values(m).sort((a, b) => b.spent - a.spent);
  }, [D]);

  if (T === null) return <main className="admin-loading" aria-live="polite">Loading admin…</main>;
  if (!T) return <Login onLogin={(t) => { sessionStorage.setItem('adm', t); setT(t); }} toast={toast} msg={msg} />;
  if (!D) return (
    <main className="admin-loading" aria-busy="true">
      <h1>Watch Flex PK — Admin</h1>
      <p role="status">{loadError || 'Loading your store data…'}</p>
      {loadError ? <button className="pri" type="button" onClick={() => load().catch((x) => { setLoadError(x.message); toast(x.message); })}>Try again</button> : null}
      <button type="button" onClick={logout}>Log out</button>
      <div id="msg" style={{ display: msg ? 'block' : 'none' }} role="status">{msg}</div>
    </main>
  );

  const transitions = { pending: ['pending', 'confirmed', 'cancelled'], confirmed: ['confirmed', 'shipped', 'cancelled'], shipped: ['shipped', 'delivered'], delivered: ['delivered'], cancelled: ['cancelled'] };
  const status = (o, ro) => ro
    ? <span className={'tag ' + o.status}>{o.status}</span>
    : <select aria-label={`Status for order ${o.ref}`} value={o.status} onChange={(e) => run(() => api('/api/admin/orders/' + encodeURIComponent(o.ref), 'PUT', { status: e.target.value }), (result) => result.notification === 'failed' ? 'Status updated; customer email failed' : result.notification === 'sent' ? 'Status updated; customer notified' : 'Status updated')}>
        {(transitions[o.status] || [o.status]).map((s) => <option key={s} value={s}>{s}</option>)}
      </select>;

  const otable = (list, ro) => !list.length ? <p>No orders yet.</p> : (
    <div className="scroll"><table>
      <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead>
      <tbody>{list.map((o) => (
        <tr key={o.ref}>
          <td><details><summary>{o.ref}</summary><div className="det">{
            `${when(o.date)}\n${o.items.map((i) => i.name + ' x' + i.qty + ' - ' + pkr(i.price * i.qty)).join('\n')}${o.promo ? '\nPromo ' + o.promo + ': -' + pkr(o.discount) : ''}\n${o.customer.address}, ${o.customer.city} ${o.customer.postal}\nPhone: ${o.customer.phone}\nEmail: ${o.customer.email}${o.customer.notes ? '\nNotes: ' + o.customer.notes : ''}`
          }</div><OrderOps order={o} onSave={(body) => run(() => api('/api/admin/orders/' + encodeURIComponent(o.ref), 'PUT', body), (result) => result.notification === 'failed' ? 'Saved; customer email failed' : result.notification === 'sent' ? 'Saved; customer notified' : 'Order details updated')} /></details></td>
          <td>{o.customer.name}<br /><small>{o.customer.city}</small></td>
          <td>{pkr(o.total)}</td>
          <td>{status(o, ro)}</td>
        </tr>
      ))}</tbody>
    </table></div>
  );

  const live = D.orders.filter((o) => o.status !== 'cancelled');
  const dash = () => {
    const collected = live.reduce((a, o) => a + ((o.payment_status === 'paid' || o.paymentStatus === 'paid') ? Number(o.total || 0) : 0), 0);
    const outstanding = live.reduce((a, o) => a + ((o.payment_status === 'paid' || o.paymentStatus === 'paid') ? 0 : Number(o.total || 0)), 0);
    const pend = D.orders.filter((o) => o.status === 'pending').length;
    const lowProducts = D.products.filter((p) => p.stock === 'out' || (p.stockQuantity != null && Number(p.stockQuantity) <= 5));
    const outOfStockCount = D.products.filter((p) => p.stock === 'out').length;
    const months = [];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    for (let i = 0; i < 6; i++) {
      const d = new Date(monthStart.getFullYear(), monthStart.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ key, label: d.toLocaleDateString('en-PK', { month: 'short', year: 'numeric' }), orders: 0, sales: 0, collected: 0 });
    }
    const byMonth = new Map(months.map((m) => [m.key, m]));
    for (const o of live) {
      const date = new Date(o.date || o.created_at);
      if (!Number.isFinite(date.getTime())) continue;
      const month = byMonth.get(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
      if (month) {
        month.orders++;
        month.sales += Number(o.total || 0);
        if (o.payment_status === 'paid' || o.paymentStatus === 'paid') month.collected += Number(o.total || 0);
      }
    }
    const bestSellers = new Map();
    for (const o of live) for (const item of (o.items || [])) {
      const current = bestSellers.get(item.id) || { id: item.id, name: item.name, units: 0, sales: 0 };
      current.units += Number(item.qty || 0);
      current.sales += Number(item.price || 0) * Number(item.qty || 0);
      bestSellers.set(item.id, current);
    }
    const topProducts = [...bestSellers.values()].sort((a, b) => b.units - a.units).slice(0, 5);
    return (
      <>
        <div className="cards">
          <div className="card"><b>{D.orders.length}</b><span>Total orders</span></div>
          <div className="card"><b>{pend}</b><span>Pending orders</span></div>
          <div className="card"><b>{pkr(collected)}</b><span>COD collected</span></div>
          <div className="card"><b>{pkr(outstanding)}</b><span>COD outstanding</span></div>
          <div className="card"><b>{customers.length}</b><span>Customers</span></div>
          <div className="card"><b>{D.products.length}</b><span>Products ({outOfStockCount} out of stock)</span></div>
          <div className="card"><b>{D.promos.filter((p) => p.active).length}</b><span>Active promo codes</span></div>
        </div>
        <div className="cards">
          <div className="card"><b>{pkr(live.reduce((a, o) => a + Number(o.total || 0), 0))}</b><span>Order value (excludes cancelled)</span></div>
          <div className="card"><b>{lowProducts.length}</b><span>Low / out of stock products</span></div>
        </div>
        <h2>Sales by month</h2>
        <div className="scroll"><table><thead><tr><th>Month</th><th>Orders</th><th>Order value</th><th>COD collected</th></tr></thead>
          <tbody>{months.map((m) => <tr key={m.key}><td>{m.label}</td><td>{m.orders}</td><td>{pkr(m.sales)}</td><td>{pkr(m.collected)}</td></tr>)}</tbody>
        </table></div>
        <h2>Top-selling products</h2>
        {!topProducts.length ? <p>No completed sales yet.</p> : <div className="scroll"><table><thead><tr><th>Product</th><th>Units</th><th>Sales value</th></tr></thead>
          <tbody>{topProducts.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.units}</td><td>{pkr(p.sales)}</td></tr>)}</tbody>
        </table></div>}
        <h2>Low-stock alerts</h2>
        {!lowProducts.length ? <p>No low-stock products.</p> : <div className="scroll"><table><thead><tr><th>Product</th><th>Stock</th></tr></thead>
          <tbody>{lowProducts.slice(0, 10).map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.stock === 'out' ? 'Out of stock' : `${p.stockQuantity} remaining`}</td></tr>)}</tbody>
        </table></div>}
        <h2>Latest orders</h2>
        {otable(D.orders.slice(0, 6), true)}
      </>
    );
  };

  const exportCsv = () => {
    const r = [['Order', 'Date', 'Name', 'Email', 'Phone', 'City', 'Address', 'Items', 'Promo', 'Discount', 'Delivery fee', 'Total', 'Payment', 'Payment status', 'Courier', 'Tracking number', 'Status']].concat(
      D.orders.map((o) => [o.ref, o.date, o.customer.name, o.customer.email, o.customer.phone, o.customer.city, o.customer.address, o.items.map((i) => i.name + ' x' + i.qty).join('; '), o.promo, o.discount, o.delivery_fee ?? o.deliveryFee ?? 0, o.total, o.payment || 'Cash on delivery', o.payment_status || o.paymentStatus || 'pending', o.shipping?.carrier || '', o.shipping?.trackingNumber || '', o.status]));
    const cell = (value) => {
      let text = String(value ?? '');
      // Prefix formula-leading spreadsheet cells so customer-provided text cannot execute as a formula.
      if (/^[\s]*[=+@\-]/.test(text)) text = `'${text}`;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const blob = new Blob(['\uFEFF' + r.map((x) => x.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'watch-flex-orders.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const orders = () => {
    const l = D.orders.filter((o) => (!sf || o.status === sf) && (!q || JSON.stringify([o.ref, o.customer]).toLowerCase().includes(q.toLowerCase())));
    return (
      <>
        <div className="bar">
          <input id="oq" aria-label="Search orders by order number, customer, phone or email" placeholder="Search order, name, phone, email" value={q} onChange={(e) => setQ(e.target.value)} />
          <select id="of" aria-label="Filter orders by status" value={sf} onChange={(e) => setSf(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button onClick={exportCsv}>Export CSV</button>
        </div>
        <p><small>Changing a status emails the customer automatically.</small></p>
        {otable(l)}
      </>
    );
  };

  const products = () => {
    const p = edit || {};
    return (
      <>
        <h2>{p.id ? 'Edit product' : 'Add product'}</h2>
        <form className="f" key={p.id || 'new'} onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const form = e.currentTarget;
          run(async () => {
            const saved = await api('/api/admin/products', 'POST', {
              id: edit && edit.id, name: f.get('name'), brand: f.get('brand'), model: f.get('model'), price: f.get('price'),
              category: f.get('category'), stock: f.get('stock'), stockQuantity: f.get('stockQuantity'), images: String(f.get('images')).split('\n'), specs: String(f.get('specs')).split(','),
              featured: f.get('featured') === 'on', isNew: f.get('isNew') === 'on',
            });
            if (!edit) form.reset();
            return saved;
          }, 'Product saved');
        }}>
          <label>Name<input name="name" required defaultValue={p.name || ''} /></label>
          <label>Brand<input name="brand" defaultValue={p.brand || ''} /></label>
          <label>Model<input name="model" defaultValue={p.model || ''} /></label>
          <label>Price (PKR)<input name="price" type="number" min="1" step="1" required defaultValue={p.price ?? ''} /></label>
          <label>Category<input name="category" defaultValue={p.category || 'Watches'} /></label>
          <label>Stock<select name="stock" defaultValue={p.stock || 'unknown'}>
            <option value="in">In stock</option><option value="out">Out of stock</option><option value="unknown">Confirm on order</option>
          </select></label>
          <label>Exact stock quantity (blank = not tracked)<input name="stockQuantity" type="number" min="0" step="1" defaultValue={p.stockQuantity ?? ''} /></label>
          <label className="w">Upload product image (JPG, PNG, WebP, AVIF; max 4 MB)<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={imageBusy} onChange={(e) => uploadImage(e.target.files?.[0])} />{imageBusy ? <small>Uploading…</small> : null}</label>
          <label className="w">Image URLs (one per line)<textarea ref={imagesRef} name="images" rows={3} defaultValue={(p.images || []).join('\n')} /></label>
          <label className="w">Specs (comma separated)<input name="specs" defaultValue={(p.specs || []).join(', ')} /></label>
          <label className="c"><input type="checkbox" name="featured" defaultChecked={!!p.featured} />Featured</label>
          <label className="c"><input type="checkbox" name="isNew" defaultChecked={!!p.isNew} />New</label>
          <div className="w"><button className="pri">{p.id ? 'Save changes' : 'Add product'}</button> {p.id ? <button type="button" onClick={() => setEdit(null)}>Cancel</button> : null}</div>
        </form>
        <div className="scroll"><table>
          <thead><tr><th>Product</th><th>Price</th><th>Stock</th><th></th></tr></thead>
          <tbody>{D.products.map((x) => (
            <tr key={x.id}>
              <td>{x.name}<br /><small>{x.brand}</small></td><td>{pkr(x.price)}</td><td>{x.stock}</td>
              <td>
                <button type="button" aria-label={`Edit ${x.name}`} onClick={() => { setEdit(x); window.scrollTo(0, 0); }}>Edit</button>{' '}
                <button type="button" className="del" aria-label={`Delete ${x.name}`} onClick={() => confirm('Delete this product?') && run(() => api('/api/admin/products/' + encodeURIComponent(x.id), 'DELETE'), 'Product deleted')}>Delete</button>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      </>
    );
  };

  const promos = () => {
    const p = edit || { type: 'percent', active: true };
    return (
      <>
        <h2>{edit ? 'Edit promo code' : 'New promo code'}</h2>
        <form className="f" key={edit ? edit.code : 'new'} onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(() => api('/api/admin/promos', 'POST', { code: f.get('code'), type: f.get('type'), value: f.get('value'), min: f.get('min'), max: f.get('max'), active: f.get('active') === 'on' }), 'Promo code saved');
        }}>
          <label>Code<input name="code" required defaultValue={p.code || ''} readOnly={!!edit} style={{ textTransform: 'uppercase' }} /></label>
          <label>Type<select name="type" defaultValue={p.type}><option value="percent">Percent off</option><option value="fixed">Fixed amount off (PKR)</option></select></label>
          <label>Value<input name="value" type="number" min="1" required defaultValue={p.value ?? ''} /></label>
          <label>Minimum order (PKR)<input name="min" type="number" min="0" defaultValue={p.min || 0} /></label>
          <label>Max uses (0 = unlimited)<input name="max" type="number" min="0" defaultValue={p.max || 0} /></label>
          <label className="c"><input type="checkbox" name="active" defaultChecked={!!p.active} />Active</label>
          <div className="w"><button className="pri">{edit ? 'Save' : 'Create code'}</button> {edit ? <button type="button" onClick={() => setEdit(null)}>Cancel</button> : null}</div>
        </form>
        <div className="scroll"><table>
          <thead><tr><th>Code</th><th>Discount</th><th>Min order</th><th>Used</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {D.promos.map((x) => (
              <tr key={x.code}>
                <td><b>{x.code}</b></td><td>{x.type === 'percent' ? x.value + '%' : pkr(x.value)}</td><td>{pkr(x.min)}</td>
                <td>{x.used}{x.max ? ' / ' + x.max : ''}</td><td>{x.active ? 'Active' : 'Off'}</td>
                <td>
                  <button type="button" aria-label={`Edit promo ${x.code}`} onClick={() => { setEdit(x); window.scrollTo(0, 0); }}>Edit</button>{' '}
                  <button type="button" className="del" aria-label={`Delete promo ${x.code}`} onClick={() => confirm('Delete this promo code?') && run(() => api('/api/admin/promos/' + encodeURIComponent(x.code), 'DELETE'), 'Promo code deleted')}>Delete</button>
                </td>
              </tr>
            ))}
            {!D.promos.length ? <tr><td colSpan={6}>No promo codes.</td></tr> : null}
          </tbody>
        </table></div>
      </>
    );
  };

  const cust = () => !customers.length ? <p>No customers yet.</p> : (
    <div className="scroll"><table>
      <thead><tr><th>Customer</th><th>Contact</th><th>City</th><th>Orders</th><th>Spent</th></tr></thead>
      <tbody>{customers.map((c) => (
        <tr key={c.email}><td>{c.name}</td><td>{c.email}<br /><small>{c.phone}</small></td><td>{c.city}</td><td>{c.n}</td><td>{pkr(c.spent)}</td></tr>
      ))}</tbody>
    </table></div>
  );

  const settings = () => (
    <>
      <h2>Store settings</h2>
      <form className="f" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => api('/api/admin/settings', 'PUT', { delivery_fee: f.get('delivery_fee') }), 'Store settings saved'); }}>
        <label>Delivery charge (PKR; 0 = free)<input name="delivery_fee" type="number" min="0" step="1" defaultValue={D.settings?.delivery_fee ?? 0} required /></label>
        <div className="w"><button className="pri">Save settings</button></div>
      </form>
      <h2>Service connections</h2>
      <p><small>Checks are performed against the services configured on the server. Secret values are never displayed.</small></p>
      <button onClick={checkHealth}>Test connections</button>
      {health ? <div className="scroll"><table><tbody>{Object.entries(health).map(([key, value]) => <tr key={key}><th>{key.replaceAll('_',' ')}</th><td>{value}</td></tr>)}</tbody></table></div> : null}
    </>
  );
  const views = { dash, orders, products, promos, cust, settings };
  return (
    <>
      <header>
        <h1>Watch Flex PK - Admin</h1>
        <nav aria-label="Admin sections">
          {TABS.map((t) => <button key={t[0]} type="button" className={tab === t[0] ? 'on' : ''} aria-pressed={tab === t[0]} onClick={() => { setTab(t[0]); setEdit(null); }}>{t[1]}</button>)}
          <button type="button" onClick={logout}>Log out</button>
        </nav>
      </header>
      <main>{views[tab]()}</main>
      <div id="msg" style={{ display: msg ? 'block' : 'none' }} role="status">{msg}</div>
    </>
  );
}

function OrderOps({ order, onSave }) {
  const [carrier, setCarrier] = useState(order.shipping?.carrier || '');
  const [trackingNumber, setTrackingNumber] = useState(order.shipping?.trackingNumber || '');
  const [paymentStatus, setPaymentStatus] = useState(order.payment_status || order.paymentStatus || 'pending');
  return (
    <div className="ord-tools" style={{ display: 'grid', gap: 6, marginTop: 10, maxWidth: 420 }}>
      <label>Courier<input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Courier company" /></label>
      <label>Tracking number<input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Tracking / consignment number" /></label>
      <label>COD payment<select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}><option value="pending">Due on delivery</option><option value="paid">Collected / paid</option></select></label>
      <button type="button" onClick={() => onSave({ carrier, trackingNumber, paymentStatus })}>Save delivery details</button>
    </div>
  );
}

function Login({ onLogin, toast, msg }) {
  const [pw, setPw] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try {
      const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Request failed');
      onLogin(j.token);
    } catch (x) { toast(x.message); }
  };
  return (
    <>
      <form className="login" onSubmit={submit}>
        <h1>Watch Flex PK - Admin</h1>
        <label htmlFor="admin-password">Admin password</label>
        <input id="admin-password" type="password" aria-label="Admin password" placeholder="Admin password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="pri">Log in</button>
      </form>
      <div id="msg" style={{ display: msg ? 'block' : 'none' }} role="status">{msg}</div>
    </>
  );
}
