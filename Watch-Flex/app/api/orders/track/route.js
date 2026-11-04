import { handler, readBody, clean, EMAIL } from '@/lib/util';
import { getOrderByRef, checkRateLimit } from '@/lib/db';
import { hashCode } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export const POST = handler(async (req) => {
  const body = await readBody(req);
  const ref = clean(body.ref, 40).toUpperCase();
  const email = clean(body.email, 120).toLowerCase();
  const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (await checkRateLimit('order-track-ip', hashCode('order-track-ip', ip), 30, 900, 900) !== 'ok') throw 'Too many tracking attempts. Try again in 15 minutes.';
  if (await checkRateLimit('order-track-pair', hashCode('order-track-pair', `${ip}:${email}`), 10, 900, 900) !== 'ok') throw 'Too many tracking attempts. Try again in 15 minutes.';
  if (!/^WF-[A-Z0-9-]{6,32}$/.test(ref) || !EMAIL.test(email)) throw 'Enter a valid order reference and email.';
  const order = await getOrderByRef(ref);
  if (!order || String(order.customer?.email || '').toLowerCase() !== email) throw 'We could not find an order matching those details.';
  return {
    ref: order.ref, date: order.date, status: order.status, items: order.items,
    subtotal: Number(order.subtotal || 0), discount: Number(order.discount || 0),
    promo: order.promo || '', deliveryFee: Number(order.delivery_fee ?? order.deliveryFee ?? 0),
    total: Number(order.total || 0), payment: order.payment,
    paymentStatus: order.payment_status || order.paymentStatus || 'pending', shipping: order.shipping || {},
    customer: { name: order.customer?.name || '', phone: order.customer?.phone || '', city: order.customer?.city || '', postal: order.customer?.postal || '', address: order.customer?.address || '' },
  };
});
