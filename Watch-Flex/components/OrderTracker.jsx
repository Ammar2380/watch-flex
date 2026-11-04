'use client';
import { useState } from 'react';
import { pkr } from '@/lib/site';

const STATUS_LABEL = { pending: 'Received', confirmed: 'Confirmed', shipped: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled' };

export default function OrderTracker() {
  const [ref, setRef] = useState('');
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setMessage(''); setOrder(null);
    try {
      const r = await fetch('/api/orders/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref, email }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Unable to find this order.');
      setOrder(j);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  const cancel = async () => {
    if (!confirm('Cancel this pending order?')) return;
    setBusy(true); setMessage('');
    try {
      const r = await fetch('/api/orders/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: order.ref, email }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Unable to cancel this order.');
      setOrder((o) => ({ ...o, status: 'cancelled' })); setMessage('Your order has been cancelled.');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  return (
    <section className="order-track" style={{ marginTop: 32, maxWidth: 640 }}>
      <h2>Track your order</h2>
      <p>Enter the order reference from your checkout confirmation and the same email address used at checkout.</p>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <label>Order reference<input required value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} placeholder="WF-261104-000001" /></label>
        <label>Email address<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <button className="btn solid" disabled={busy}>{busy ? 'Please wait…' : 'Find order'}</button>
      </form>
      {message ? <p role="status">{message}</p> : null}
      {order ? (
        <div style={{ marginTop: 18, padding: 16, border: '1px solid currentColor' }}>
          <h3>{order.ref} — {STATUS_LABEL[order.status] || order.status}</h3>
          <p>Placed: {new Date(order.date).toLocaleString()} · Total: {pkr(order.total)}</p>
          <div id="wf-invoice" style={{ marginTop: 16 }}>
            <header><h3>WATCH FLEX PK</h3><p>Customer invoice · {order.ref}</p></header>
            <p><b>Customer:</b> {order.customer?.name || 'Customer'}<br />{order.customer?.address}<br />{order.customer?.city} {order.customer?.postal}<br />{order.customer?.phone}</p>
            <div className="scroll"><table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th align="left">Item</th><th align="right">Qty</th><th align="right">Amount</th></tr></thead>
              <tbody>{(order.items || []).map((i) => <tr key={i.id}><td>{i.name}</td><td align="right">{i.qty}</td><td align="right">{pkr(i.price * i.qty)}</td></tr>)}</tbody>
            </table></div>
            <p>Subtotal: {pkr(order.subtotal)}<br />{order.discount ? <>Promo {order.promo}: −{pkr(order.discount)}<br /></> : null}Delivery: {order.deliveryFee ? pkr(order.deliveryFee) : 'Free'}<br /><b>Total: {pkr(order.total)}</b></p>
            <p>Payment: {order.payment || 'Cash on delivery'} · {order.paymentStatus === 'paid' ? 'Paid' : 'Due on delivery'}</p>
            <p>Order status: {STATUS_LABEL[order.status] || order.status}{order.shipping?.carrier ? ` · ${order.shipping.carrier}` : ''}{order.shipping?.trackingNumber ? ` · Tracking ${order.shipping.trackingNumber}` : ''}</p>
          </div>
          <button className="btn invoice-print" type="button" onClick={() => window.print()}>Print / save invoice</button>
          {order.status === 'pending' ? <button className="btn" type="button" disabled={busy} onClick={cancel}>Cancel pending order</button> : null}
        </div>
      ) : null}
    </section>
  );
}
