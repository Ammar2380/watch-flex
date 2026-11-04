import { handler, readBody, clean, EMAIL } from '@/lib/util';
import { okTok } from '@/lib/auth';
import { createOrder, getOrderByRef } from '@/lib/db';
import { mail, orderMail } from '@/lib/mail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = handler(async (req) => {
  const body = await readBody(req);
  const { items, customer: c = {}, promo, token } = body;
  const email = clean(c.email, 120).toLowerCase();
  if (!Array.isArray(items) || !items.length || items.length > 30) throw 'Your bag is empty.';
  if (!EMAIL.test(email) || !okTok(email, token)) throw 'Please verify your email first.';
  if (clean(body.website, 200)) throw 'Unable to process this request.';
  for (const k of ['name', 'phone', 'city', 'postal', 'address']) {
    if (clean(c[k]).length < (k === 'address' ? 10 : 2)) throw 'Please fill in all delivery details.';
  }
  const idempotencyKey = clean(body.idempotencyKey, 120);
  if (idempotencyKey.length < 16) throw 'Please refresh checkout and try again.';
  const customer = {
    name: clean(c.name, 80), phone: clean(c.phone, 30), email,
    city: clean(c.city, 60), postal: clean(c.postal, 10),
    address: clean(c.address, 300), notes: clean(c.notes, 400),
  };
  const quantities = new Map();
  for (const item of items) {
    const id = clean(item?.id, 100);
    const qty = Number(item?.qty);
    if (!id || !Number.isInteger(qty) || qty < 1 || qty > 99) throw 'One of the item quantities is invalid.';
    const next = (quantities.get(id) || 0) + qty;
    if (next > 99) throw 'The quantity for an item cannot exceed 99.';
    quantities.set(id, next);
  }
  const result = await createOrder({
    items: [...quantities].map(([id, qty]) => ({ id, qty })),
    customer, promo: clean(promo, 40).toUpperCase() || null, idempotencyKey,
  });
  const savedOrder = await getOrderByRef(result.ref);
  const order = savedOrder || { ref: result.ref, customer, items: [], total: Number(result.total), discount: Number(result.discount), deliveryFee: Number(result.delivery_fee), promo: clean(promo, 40).toUpperCase(), payment: 'Cash on delivery' };
  order.deliveryFee = Number(order.delivery_fee ?? order.deliveryFee ?? 0);
  const mailResults = await Promise.allSettled([
    mail(email, `Order ${order.ref} received - Watch Flex PK`, orderMail(order, 'Thank you! We received your order and will contact you to arrange delivery.')),
    ...(process.env.ADMIN_EMAIL ? [mail(process.env.ADMIN_EMAIL, `New order ${order.ref} - ${order.total}`, orderMail(order, 'A new order was placed.'))] : []),
  ]);
  const customerEmailSent = mailResults[0]?.status === 'fulfilled';
  if (!customerEmailSent) console.error('[orders] customer notification failed', mailResults[0]?.reason);
  if (mailResults.some((r) => r.status === 'rejected')) console.error('[orders] one or more order notifications failed');
  return { ref: result.ref, discount: Number(result.discount), deliveryFee: Number(result.delivery_fee), total: Number(result.total), subtotal: Number(savedOrder?.subtotal || 0), items: savedOrder?.items || [], promo: savedOrder?.promo || '', customerEmailSent };
});
