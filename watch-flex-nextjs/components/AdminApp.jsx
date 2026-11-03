'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pkr } from '@/lib/site';

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const TABS = [['dash', 'Dashboard'], ['orders', 'Orders'], ['products', 'Products'], ['promos', 'Promo codes'], ['cust', 'Customers']];
const when = (d) => new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export default function AdminApp() {
  const [T, setT] = useState(null); // null = not read yet, '' = logged out
  const [D, setD] = useState(null);
  const [tab, setTab] = useState('dash');
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState('');
  const [sf, setSf] = useState('');
  const [msg, setMsg] = useState('');
  const timer = useRef(0);
  const toast = useCallback((t) => { setMsg(t); clearTimeout(timer.current); timer.current = setTimeout(() => setMsg(''), 2800); }, []);

  useEffect(() => { setT(sessionStorage.getItem('adm') || ''); }, []);

  const logout = useCallback(() => { sessionStorage.removeItem('adm'); setT(''); setD(null); }, []);
  const api = useCallback(async (u, m = 'GET', b, token = T) => {
    const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json', 'x-admin-token': token || '' }, body: b ? JSON.stringify(b) : undefined });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && token) logout();
    if (!r.ok) throw new Error(j.error || 'Request failed');
    return j;
  }, [T, logout]);
  const load = useCallback(async () => { setD(await api('/api/admin/data')); }, [api]);
  useEffect(() => { if (T && !D) load().catch((x) => toast(x.message)); }, [T, D, load, toast]);

  const run = async (f, ok) => {
    try { await f(); toast(ok); setEdit(null); await load(); } catch (x) { toast(x.message); }
  };

  const customers = useMemo(() => {
    const m = {};
    (D?.orders || []).forEach((o) => {
      const c = m[o.customer.email] || (m[o.customer.email] = { ...o.customer, n: 0, spent: 0, last: o.date });
      c.n++;
      if (o.status !== 'cancelled') c.spent += o.total;
      if (o.date > c.last) c.last = o.date;
    });
    return Object.values(m).sort((a, b) => b.spent - a.spent);
  }, [D]);

  if (T === null) return null;
  if (!T) return <Login onLogin={(t) => { sessionStorage.setItem('adm', t); setT(t); }} toast={toast} msg={msg} />;
  if (!D) return <><div id="msg" style={{ display: msg ? 'block' : 'none' }} role="status">{msg}</div></>;

  const status = (o, ro) => ro
    ? <span className={'tag ' + o.status}>{o.status}</span>
    : <select value={o.status} onChange={(e) => run(() => api('/api/admin/orders/' + encodeURIComponent(o.ref), 'PUT', { status: e.target.value }), 'Status updated, customer emailed')}>
        {STATUSES.map((s) => <option key={s}>{s}</option>)}
      </select>;

  const otable = (list, ro) => !list.length ? <p>No orders yet.</p> : (
    <div className="scroll"><table>
      <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead>
      <tbody>{list.map((o) => (
        <tr key={o.ref}>
          <td><details><summary>{o.ref}</summary><div className="det">{
            `${when(o.date)}\n${o.items.map((i) => i.name + ' x' + i.qty + ' - ' + pkr(i.price * i.qty)).join('\n')}${o.promo ? '\nPromo ' + o.promo + ': -' + pkr(o.discount) : ''}\n${o.customer.address}, ${o.customer.city} ${o.customer.postal}\nPhone: ${o.customer.phone}\nEmail: ${o.customer.email}${o.customer.notes ? '\nNotes: ' + o.customer.notes : ''}`
          }</div></details></td>
          <td>{o.customer.name}<br /><small>{o.customer.city}</small></td>
          <td>{pkr(o.total)}</td>
          <td>{status(o, ro)}</td>
        </tr>
      ))}</tbody>
    </table></div>
  );

  const live = D.orders.filter((o) => o.status !== 'cancelled');
  const dash = () => {
    const rev = live.reduce((a, o) => a + o.total, 0);
    const pend = D.orders.filter((o) => o.status === 'pending').length;
    const low = D.products.filter((p) => p.stock === 'out').length;
    return (
      <>
        <div className="cards">
          <div className="card"><b>{D.orders.length}</b><span>Total orders</span></div>
          <div className="card"><b>{pend}</b><span>Pending orders</span></div>
          <div className="card"><b>{pkr(rev)}</b><span>Revenue (not cancelled)</span></div>
          <div className="card"><b>{customers.length}</b><span>Customers</span></div>
          <div className="card"><b>{D.products.length}</b><span>Products ({low} out of stock)</span></div>
          <div className="card"><b>{D.promos.filter((p) => p.active).length}</b><span>Active promo codes</span></div>
        </div>
        <h2>Latest orders</h2>
        {otable(D.orders.slice(0, 6), true)}
      </>
    );
  };

  const exportCsv = () => {
    const r = [['Order', 'Date', 'Name', 'Email', 'Phone', 'City', 'Address', 'Items', 'Promo', 'Discount', 'Total', 'Status']].concat(
      D.orders.map((o) => [o.ref, o.date, o.customer.name, o.customer.email, o.customer.phone, o.customer.city, o.customer.address, o.items.map((i) => i.name + ' x' + i.qty).join('; '), o.promo, o.discount, o.total, o.status]));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([r.map((x) => x.map((v) => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n')], { type: 'text/csv' }));
    a.download = 'orders.csv';
    a.click();
  };
  const orders = () => {
    const l = D.orders.filter((o) => (!sf || o.status === sf) && (!q || JSON.stringify([o.ref, o.customer]).toLowerCase().includes(q.toLowerCase())));
    return (
      <>
        <div className="bar">
          <input id="oq" placeholder="Search order, name, phone, email" value={q} onChange={(e) => setQ(e.target.value)} />
          <select id="of" value={sf} onChange={(e) => setSf(e.target.value)}>
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
          run(() => api('/api/admin/products', 'POST', {
            id: edit && edit.id, name: f.get('name'), brand: f.get('brand'), model: f.get('model'), price: f.get('price'),
            category: f.get('category'), stock: f.get('stock'), images: String(f.get('images')).split('\n'), specs: String(f.get('specs')).split(','),
            featured: f.get('featured') === 'on', isNew: f.get('isNew') === 'on',
          }), 'Product saved');
        }}>
          <label>Name<input name="name" required defaultValue={p.name || ''} /></label>
          <label>Brand<input name="brand" defaultValue={p.brand || ''} /></label>
          <label>Model<input name="model" defaultValue={p.model || ''} /></label>
          <label>Price (PKR)<input name="price" type="number" min="0" required defaultValue={p.price ?? ''} /></label>
          <label>Category<input name="category" defaultValue={p.category || 'Watches'} /></label>
          <label>Stock<select name="stock" defaultValue={p.stock || 'unknown'}>
            <option value="in">In stock</option><option value="out">Out of stock</option><option value="unknown">Confirm on order</option>
          </select></label>
          <label className="w">Image URLs (one per line)<textarea name="images" rows={3} defaultValue={(p.images || []).join('\n')} /></label>
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
                <button onClick={() => { setEdit(x); window.scrollTo(0, 0); }}>Edit</button>{' '}
                <button className="del" onClick={() => confirm('Delete this product?') && run(() => api('/api/admin/products/' + encodeURIComponent(x.id), 'DELETE'), 'Product deleted')}>Delete</button>
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
                  <button onClick={() => { setEdit(x); window.scrollTo(0, 0); }}>Edit</button>{' '}
                  <button className="del" onClick={() => confirm('Delete this promo code?') && run(() => api('/api/admin/promos/' + encodeURIComponent(x.code), 'DELETE'), 'Promo code deleted')}>Delete</button>
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

  const views = { dash, orders, products, promos, cust };
  return (
    <>
      <header>
        <h1>Watch Flex PK - Admin</h1>
        <nav>
          {TABS.map((t) => <button key={t[0]} className={tab === t[0] ? 'on' : ''} onClick={() => { setTab(t[0]); setEdit(null); }}>{t[1]}</button>)}
          <button onClick={logout}>Log out</button>
        </nav>
      </header>
      <main>{views[tab]()}</main>
      <div id="msg" style={{ display: msg ? 'block' : 'none' }} role="status">{msg}</div>
    </>
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
        <input type="password" placeholder="Admin password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="pri">Log in</button>
      </form>
      <div id="msg" style={{ display: msg ? 'block' : 'none' }} role="status">{msg}</div>
    </>
  );
}
