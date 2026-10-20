import { useState, type ChangeEvent, type FormEvent } from 'react';
import { money, orderEndpoint } from '../config';
import type { CartLine } from '../types';
import { buildOrder, submitOrder, type Customer, type OrderResult } from '../services/orderService';

type Errors = Partial<Record<keyof Customer, string>>;
const blank: Customer = { name: '', phone: '', city: '', address: '', notes: '' };
const mobileOk = (s: string) => /^(?:\+92|0092|0)?3\d{9}$/.test(s.replace(/[\s-]/g, ''));
const input = 'w-full min-w-0 bg-transparent border-b border-neutral-400 dark:border-neutral-600 focus:border-brandRed outline-none py-3 text-sm leading-5';

function validate(f: Customer): Errors {
  const e: Errors = {};
  if (f.name.trim().length < 2) e.name = 'Enter your full name.';
  if (!mobileOk(f.phone)) e.phone = 'Enter a valid Pakistani mobile number, e.g. 0300 1234567.';
  if (f.city.trim().length < 2) e.city = 'Enter your city.';
  if (f.address.trim().length < 10) e.address = 'Enter your full delivery address: house, street and area.';
  return e;
}

interface Props { lines: CartLine[]; subtotal: number; onBack: () => void; onAccepted: () => void; onClose: () => void }

export default function CheckoutForm({ lines, subtotal, onBack, onAccepted, onClose }: Props) {
  const [f, setF] = useState<Customer>(blank);
  const [err, setErr] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<OrderResult | null>(null);
  const set = (k: keyof Customer) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setF(s => ({ ...s, [k]: value }));
    setErr(s => ({ ...s, [k]: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const v = validate(f);
    setErr(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    setRes(null);
    try {
      const r = await submitOrder(buildOrder({ name: f.name.trim(), phone: f.phone.trim(), city: f.city.trim(), address: f.address.trim(), notes: f.notes.trim() }, lines, subtotal));
      setRes(r);
      if (r.status === 'accepted') onAccepted(); // Clear the bag only after a confirmed order.
    } catch {
      setRes({ status: 'failed', reason: 'Could not submit the order.' });
    } finally {
      setBusy(false);
    }
  };

  if (res?.status === 'accepted') {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4" role="status">
        <h3 className="text-xl font-black uppercase tracking-tight text-brandRed">Order received</h3>
        <p className="text-sm break-words">Your reference is <strong>{res.reference}</strong>. Pay in cash when your order arrives.</p>
        <button onClick={onClose} className="w-full min-h-12 bg-brandRed hover:bg-red-700 text-white font-bold py-4 rounded-xl uppercase tracking-wider text-xs">Close</button>
      </div>
    );
  }

  const field = (k: keyof Customer, label: string, o: { type?: string; rows?: number; auto?: string; optional?: boolean } = {}) => {
    const id = `co-${k}`;
    const p = {
      id, name: k, value: f[k], onChange: set(k), autoComplete: o.auto, className: input,
      'aria-invalid': !!err[k], 'aria-describedby': err[k] ? `${id}-e` : undefined,
      required: !o.optional, maxLength: k === 'notes' || k === 'address' ? 500 : k === 'phone' ? 24 : 120,
    };
    return (
      <div className="min-w-0">
        <label htmlFor={id} className="block text-xs font-mono uppercase tracking-wider text-neutral-500">{label}{o.optional && ' (optional)'}</label>
        {o.rows ? <textarea rows={o.rows} {...p} className={`${input} resize-y`} /> : <input type={o.type ?? 'text'} {...p} inputMode={k === 'phone' ? 'tel' : undefined} />}
        {err[k] && <p id={`${id}-e`} className="mt-1 text-xs leading-relaxed text-brandRed">{err[k]}</p>}
      </div>
    );
  };

  return (
    <form noValidate onSubmit={submit} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5">
      <button type="button" onClick={onBack} className="min-h-11 px-1 text-xs font-mono uppercase tracking-wider text-neutral-500 hover:text-brandRed">Back to bag</button>
      {!orderEndpoint && (
        <p className="border border-brandRed text-brandRed text-xs leading-relaxed p-3" role="note">
          Demo checkout: no order service is connected, so orders cannot be placed yet. Nothing will be submitted.
        </p>
      )}
      {field('name', 'Full name', { auto: 'name' })}
      {field('phone', 'Mobile number', { type: 'tel', auto: 'tel' })}
      {field('city', 'City', { auto: 'address-level2' })}
      {field('address', 'Delivery address', { rows: 3, auto: 'street-address' })}
      {field('notes', 'Delivery notes', { rows: 2, optional: true })}
      <div className="border-t border-neutral-300 dark:border-neutral-800 pt-4 text-sm space-y-2">
        {lines.map(l => (
          <div key={l.product.id} className="flex justify-between items-start gap-3 min-w-0">
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{l.product.name} × {l.qty}</span>
            <span className="shrink-0 text-right tabular-nums">{money(l.product.price * l.qty)}</span>
          </div>
        ))}
        <div className="flex justify-between gap-3 font-bold pt-2"><span>Subtotal</span><span className="shrink-0 tabular-nums">{money(subtotal)}</span></div>
        <p className="text-xs text-neutral-500 pt-1">Cash on Delivery available all over Pakistan.</p>
      </div>
      {res && (
        <p role="alert" className="border border-brandRed text-brandRed text-xs leading-relaxed p-3">
          {res.status === 'not_submitted'
            ? 'Your order was NOT submitted because no order service is connected. Your bag has been kept.'
            : `${res.reason} Your order was not placed and your bag has been kept. Please try again.`}
        </p>
      )}
      <button type="submit" disabled={busy} className="w-full min-h-12 bg-brandRed hover:bg-red-700 disabled:opacity-60 text-white font-bold py-4 rounded-xl shadow-lg uppercase tracking-wider text-xs">
        {busy ? 'Sending…' : orderEndpoint ? 'Place order (Cash on Delivery)' : 'Test checkout (not submitted)'}
      </button>
    </form>
  );
}
