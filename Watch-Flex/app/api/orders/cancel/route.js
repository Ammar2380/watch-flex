import { handler, readBody, clean, EMAIL } from '@/lib/util';
import { getOrderByRef, cancelOrder, checkRateLimit } from '@/lib/db';
import { hashCode } from '@/lib/auth';
import { mail, orderMail, STATUS } from '@/lib/mail';
export const dynamic = 'force-dynamic';
export const POST = handler(async (req) => {
  const body = await readBody(req);
  const ref = clean(body.ref, 40).toUpperCase();
  const email = clean(body.email, 120).toLowerCase();
  const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (await checkRateLimit('order-cancel-ip', hashCode('order-cancel-ip', ip), 20, 900, 900) !== 'ok' ||
      await checkRateLimit('order-cancel-pair', hashCode('order-cancel-pair', `${ip}:${ref}:${email}`), 5, 900, 900) !== 'ok') {
    throw 'Too many cancellation attempts. Try again in 15 minutes.';
  }
  if (!EMAIL.test(email)) throw 'Enter the email used at checkout.';
  const order = await getOrderByRef(ref);
  if (!order || String(order.customer?.email || '').toLowerCase() !== email) throw 'We could not find an order matching those details.';
  if (order.status !== 'pending') throw 'Only pending orders can be cancelled online. Please contact support for help.';
  const updated = await cancelOrder(ref, email);
  if (!updated) throw 'We could not find an order matching those details.';
  let customerEmailSent = false;
  try { await mail(email, `Order ${ref}: cancelled`, orderMail(order, STATUS.cancelled)); customerEmailSent = true; }
  catch (error) { console.error('[orders] cancellation email failed', error); }
  return { ok: true, ref: updated.ref, status: updated.status, customerEmailSent };
});
