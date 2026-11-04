'use client';
import { useEffect, useState } from 'react';
import { NavLink, useShop } from './ShopProvider';
import Wm from './Wm';
import { pkr, WA } from '@/lib/site';
import { subtotalOf } from '@/lib/catalog';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FIELDS = [
  ['name', 'Full name', 'text', { autoComplete: 'name' }],
  ['phone', 'Phone number', 'tel', { autoComplete: 'tel', inputMode: 'tel', placeholder: '03XX XXXXXXX' }],
  ['email', 'Email', 'email', { autoComplete: 'email', inputMode: 'email' }],
  ['city', 'City', 'text', { autoComplete: 'address-level2' }],
  ['postal', 'Postal code', 'text', { autoComplete: 'postal-code', inputMode: 'numeric', maxLength: 5, placeholder: '5 digits' }],
];
const EMPTY = { name: '', phone: '', email: '', city: '', postal: '', address: '', notes: '' };
function newCheckoutKey() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `wf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function loadCheckoutKey() {
  try {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('wf-checkout-idempotency');
      if (saved) return saved;
      const key = newCheckoutKey(); sessionStorage.setItem('wf-checkout-idempotency', key); return key;
    }
  } catch {}
  return newCheckoutKey();
}

function validate(d) {
  const e = {};
  const ph = d.phone.replace(/[\s\-()]/g, '');
  if (d.name.trim().length < 2) e.name = 'Please enter your full name.';
  if (!/^\+?\d{10,13}$/.test(ph)) e.phone = 'Enter a valid phone number, e.g. 03XX XXXXXXX.';
  if (!EMAIL.test(d.email.trim())) e.email = 'Enter a valid email address.';
  if (d.city.trim().length < 2) e.city = 'Please enter your city.';
  if (!/^\d{5}$/.test(d.postal.trim())) e.postal = 'Postal code must be 5 digits.';
  if (d.address.trim().length < 10) e.address = 'Please enter your full address (house, street, area).';
  return e;
}

async function api(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .catch(() => { throw new Error('Cannot reach the shop server. Please try again.'); });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Something went wrong.');
  return j;
}

function Summary({ rows, pr, deliveryFee = 0, actualDiscount }) {
  const s = subtotalOf(rows);
  const dc = Number.isFinite(actualDiscount) ? actualDiscount : (pr ? Math.min(s, pr.type === 'percent' ? Math.round((s * pr.value) / 100) : pr.value) : 0);
  return (
    <aside className="os">
      <h2>Your order</h2>
      {rows.map(([p, q]) => <div className="ol" key={p.id}><span>{p.name} × {q}</span><span>{pkr(p.price * q)}</span></div>)}
      {dc ? <div className="ol"><span>Promo {pr.code}</span><span>- {pkr(dc)}</span></div> : null}
      <div className="ol"><span>Delivery</span><span>{deliveryFee ? pkr(deliveryFee) : 'Free'}</span></div>
      <div className="ol tot"><span>Total</span><span>{pkr(s - dc + deliveryFee)}</span></div>
      <small>Payment: cash on delivery. Delivery charges are set by the store.</small>
    </aside>
  );
}

export default function CheckoutView() {
  const { okRows, removeMany, scrollTop } = useShop();
  const [d, setD] = useState(EMPTY);
  const [errs, setErrs] = useState({});
  const [ferr, setFerr] = useState('');
  const [vt, setVt] = useState({ token: '', email: '' });
  const [vcode, setVcode] = useState('');
  const [vmsg, setVmsg] = useState({ t: '', ok: false });
  const [vsBusy, setVsBusy] = useState(false);
  const [promo, setPromo] = useState('');
  const [pr, setPr] = useState(null);
  const [pmsg, setPmsg] = useState({ t: '', ok: false });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [deliveryReady, setDeliveryReady] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(loadCheckoutKey);
  const rows = okRows();

  useEffect(() => { if (done) scrollTop(); }, [done, scrollTop]);
  useEffect(() => { fetch('/api/store-config').then((r) => r.ok ? r.json() : Promise.reject(new Error('Could not load delivery settings.'))).then((j) => { if (j && Number.isFinite(Number(j.delivery_fee))) setDeliveryFee(Math.max(0, Number(j.delivery_fee))); setDeliveryReady(true); }).catch(() => setFerr('Delivery fee could not be loaded. Refresh this page before placing your order.')); }, []);

  if (done) {
    return (
      <>
        <div className="bw"><Wm text="THANK YOU" /><div className="rule"></div></div>
        <section className="co done">
          <div>
            <h2>Order {done.ref} received</h2>
            <p>Thank you, {done.d.name}. We will confirm availability and delivery details with you on {done.d.phone}. Payment is cash on delivery.</p>
            <p>{done.emailSent ? `A confirmation email was sent to ${done.d.email}.` : `Your order is saved, but the confirmation email could not be sent. Please contact us on WhatsApp with order ${done.ref}.`}</p>
            <div className="cobtns"><NavLink className="btn solid" href="/">Back to shop</NavLink> <a className="btn" href={`https://wa.me/${WA}?text=${encodeURIComponent(`Hello Watch Flex PK, I placed order ${done.ref}.\nName: ${done.d.name}\nPhone: ${done.d.phone}\nDelivery: ${done.d.address}, ${done.d.city} ${done.d.postal}\nItems: ${done.rows.map(([p, q]) => `${p.name} x${q}`).join(', ')}\nTotal: PKR ${done.total.toLocaleString('en-PK')}\nPlease confirm my order.`)}`} target="_blank" rel="noopener noreferrer">Send order on WhatsApp</a></div>
          </div>
          <Summary rows={done.rows} pr={done.pr} deliveryFee={done.deliveryFee} actualDiscount={done.discount} />
        </section>
      </>
    );
  }
  if (!rows.length) {
    return (
      <>
        <div className="bw"><Wm text="CHECKOUT" /><div className="rule"></div></div>
        <div className="pg"><p>Your bag is empty.</p><NavLink className="btn" href="/">Back to shop</NavLink></div>
      </>
    );
  }

  const set = (k, v) => {
    if (k === 'postal') v = v.replace(/\D/g, '');
    setD((x) => ({ ...x, [k]: v }));
    if (errs[k]) setErrs((e) => ({ ...e, [k]: '' }));
    if (k === 'email' && vt.token && v.trim().toLowerCase() !== vt.email) { setVt({ token: '', email: '' }); setVmsg({ t: '', ok: false }); }
  };
  const emailNow = d.email.trim().toLowerCase();

  const sendCode = async () => {
    if (!EMAIL.test(emailNow)) return setVmsg({ t: 'Enter a valid email address first.', ok: false });
    setVsBusy(true);
    try {
      await api('/api/verify/send', { email: emailNow });
      setTimeout(() => setVsBusy(false), 30000);
      setVmsg({ t: 'Code sent to ' + emailNow + '. Check your inbox and spam folder.', ok: true });
    } catch (x) { setVsBusy(false); setVmsg({ t: x.message, ok: false }); }
  };
  const checkCode = async () => {
    try {
      const j = await api('/api/verify/check', { email: emailNow, code: vcode.trim() });
      setVt({ token: j.token, email: emailNow });
      setVmsg({ t: 'Email verified.', ok: true });
    } catch (x) { setVmsg({ t: x.message, ok: false }); }
  };
  const applyPromo = async () => {
    try {
      const j = await api('/api/promo', { code: promo, subtotal: subtotalOf(rows) });
      setPr(j);
      setPmsg({ t: j.label + ' applied.', ok: true });
    } catch (x) { setPr(null); setPmsg({ t: x.message, ok: false }); }
  };
  const submit = async (e) => {
    e.preventDefault();
    const dd = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.trim()]));
    const er = validate(dd);
    setFerr('');
    setErrs(er);
    const first = Object.keys(er)[0];
    if (first) { document.getElementById(first)?.focus(); return; }
    if (!deliveryReady) { setFerr('Delivery fee is still loading. Refresh and try again.'); return; }
    if (!vt.token || vt.email !== dd.email.toLowerCase()) {
      setFerr('Please verify your email with the code we send you.');
      document.getElementById('vs')?.focus();
      return;
    }
    setBusy(true);
    try {
      const website = e.currentTarget.elements.website?.value || '';
      const j = await api('/api/orders', { items: rows.map(([p, q]) => ({ id: p.id, qty: q })), customer: dd, promo: pr && pr.code, token: vt.token, idempotencyKey, website });
      const confirmedRows = Array.isArray(j.items) && j.items.length ? j.items.map((i) => [{ id: i.id, name: i.name, price: Number(i.price) }, Number(i.qty)]) : rows;
      setDone({ ref: j.ref, d: dd, rows: confirmedRows, pr: j.discount ? pr : null, discount: Number(j.discount || 0), deliveryFee: Number(j.deliveryFee ?? deliveryFee), total: Number(j.total || 0), emailSent: !!j.customerEmailSent });
      removeMany(rows.map(([p]) => p.id));
      setPr(null); setVt({ token: '', email: '' });
      const nextKey = newCheckoutKey();
      try { sessionStorage.setItem('wf-checkout-idempotency', nextKey); } catch {}
      setIdempotencyKey(nextKey);
    } catch (x) { setBusy(false); setFerr(x.message); }
  };

  const ff = ([k, label, type, extra]) => (
    <div className="ff" key={k}>
      <label htmlFor={k}>{label}</label>
      <input id={k} name={k} type={type} {...extra} value={d[k]} onChange={(e) => set(k, e.target.value)}
        className={errs[k] ? 'bad' : undefined} aria-invalid={errs[k] ? 'true' : 'false'} aria-describedby={'e-' + k} required />
      <small className="er" id={'e-' + k}>{errs[k] || ''}</small>
    </div>
  );

  return (
    <>
      <div className="bw"><Wm text="CHECKOUT" /><div className="rule"></div></div>
      <section className="co">
        <form id="of" noValidate onSubmit={submit}>
          <h2>Your details</h2>
          <div className="fgrid">
            {FIELDS.map(ff)}
            <div className="ff full">
              <label htmlFor="address">Full delivery address</label>
              <textarea id="address" name="address" rows={2} autoComplete="street-address" aria-describedby="e-address" required
                value={d.address} onChange={(e) => set('address', e.target.value)} className={errs.address ? 'bad' : undefined} aria-invalid={errs.address ? 'true' : 'false'} />
              <small className="er" id="e-address">{errs.address || ''}</small>
            </div>
            <div className="ff full">
              <label htmlFor="notes">Order notes (optional)</label>
              <textarea id="notes" name="notes" rows={2} value={d.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>
          </div>
          <input className="hp" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <div className="ferr" id="ferr" role="alert">{ferr}</div>
          <div className="ff full">
            <label htmlFor="vcode">Verify your email</label>
            <div className="rowx">
              <button type="button" className="btn" id="vs" disabled={vsBusy} onClick={sendCode}>Send code</button>
              <input id="vcode" inputMode="numeric" maxLength={6} autoComplete="one-time-code" placeholder="6-digit code" value={vcode} onChange={(e) => setVcode(e.target.value)} />
              <button type="button" className="btn" id="vc" onClick={checkCode}>Verify</button>
            </div>
            <small className={'er' + (vmsg.ok ? ' ok' : '')} id="vmsg" role="status">{vmsg.t}</small>
          </div>
          <div className="ff full">
            <label htmlFor="promo">Promo code (optional)</label>
            <div className="rowx">
              <input id="promo" autoCapitalize="characters" autoComplete="off" placeholder="Enter code" value={promo} onChange={(e) => setPromo(e.target.value)} />
              <button type="button" className="btn" id="pa" onClick={applyPromo}>Apply</button>
            </div>
            <small className={'er' + (pmsg.ok ? ' ok' : '')} id="pmsg" role="status">{pmsg.t}</small>
          </div>
          <div className="cobtns"><button type="submit" className="btn solid" id="po" disabled={busy || !deliveryReady}>{busy ? 'Sending...' : 'Place order'}</button></div>
          <small className="hint">We send an email confirmation after the order is saved. Payment is cash on delivery.</small>
        </form>
        <Summary rows={rows} pr={pr} deliveryFee={deliveryFee} />
      </section>
    </>
  );
}
