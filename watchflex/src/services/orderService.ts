import { currency, orderEndpoint } from '../config';
import type { CartLine } from '../types';

export interface Customer { name: string; phone: string; city: string; address: string; notes: string }
export interface OrderRequest {
  customer: Customer;
  items: { id: number; name: string; qty: number; unitPrice: number }[];
  subtotal: number; currency: string; paymentMethod: 'COD';
}
export type OrderResult =
  | { status: 'accepted'; reference: string }
  | { status: 'not_submitted'; reason: string }
  | { status: 'failed'; reason: string };

export const buildOrder = (customer: Customer, lines: CartLine[], subtotal: number): OrderRequest => ({
  customer,
  items: lines.map(l => ({ id: l.product.id, name: l.product.name, qty: l.qty, unitPrice: l.product.price })),
  subtotal, currency: currency.code, paymentMethod: 'COD',
});

/**
 * The only place that talks to a backend. "accepted" is returned ONLY when the service replies 2xx
 * with JSON { reference: string }. Without VITE_ORDER_API_URL nothing is sent.
 */
export async function submitOrder(order: OrderRequest): Promise<OrderResult> {
  if (!orderEndpoint) return { status: 'not_submitted', reason: 'No order service is connected.' };
  try {
    const res = await fetch(orderEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) });
    if (!res.ok) return { status: 'failed', reason: `The order service responded with an error (${res.status}).` };
    const data = await res.json().catch(() => null);
    if (data && typeof data.reference === 'string' && data.reference.trim().length > 0) return { status: 'accepted', reference: data.reference.trim() };
    return { status: 'failed', reason: 'The order service did not confirm the order.' };
  } catch {
    return { status: 'failed', reason: 'Could not reach the order service.' };
  }
}
