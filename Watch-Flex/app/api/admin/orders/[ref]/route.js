import { handler, readBody, clean } from '@/lib/util';
import { requireAdmin } from '@/lib/auth';
import { getOrderByRef, updateOrder, cancelOrder } from '@/lib/db';
import { mail, orderMail, STATUS } from '@/lib/mail';

export const dynamic = 'force-dynamic';
export const PUT = handler(async (req, ctx) => {
  requireAdmin(req);
  const { ref } = await ctx.params;
  const body = await readBody(req);
  const current = await getOrderByRef(ref);
  if (!current) throw 'Order not found.';
  const patch = {};
  if (body.status !== undefined) {
    if (!['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(body.status)) throw 'Invalid order status.';
    const transitions = { pending: ['pending','confirmed','cancelled'], confirmed: ['confirmed','shipped','cancelled'], shipped: ['shipped','delivered'], delivered: ['delivered'], cancelled: ['cancelled'] };
    if (!transitions[current.status]?.includes(body.status)) throw 'That order status change is not allowed.';
    patch.status = body.status;
  }
  const shipping = { ...(current.shipping || {}) };
  if (body.carrier !== undefined) shipping.carrier = clean(body.carrier, 80);
  if (body.trackingNumber !== undefined) shipping.trackingNumber = clean(body.trackingNumber, 100);
  if (body.shippingNotes !== undefined) shipping.notes = clean(body.shippingNotes, 300);
  if (Object.keys(shipping).length) patch.shipping = shipping;
  if (body.paymentStatus !== undefined) {
    if (!['pending', 'paid'].includes(body.paymentStatus)) throw 'Invalid COD payment status.';
    patch.payment_status = body.paymentStatus;
  }
  let updated;
  if (patch.status === 'cancelled' && current.status !== 'cancelled') {
    updated = await cancelOrder(ref);
    if (!updated) throw 'Order could not be cancelled.';
    delete patch.status;
  }
  if (Object.keys(patch).length) updated = await updateOrder(ref, patch);
  updated ||= current;
  const trackingChanged = (body.carrier !== undefined && clean(body.carrier, 80) !== (current.shipping?.carrier || '')) ||
    (body.trackingNumber !== undefined && clean(body.trackingNumber, 100) !== (current.shipping?.trackingNumber || ''));
  const statusChanged = !!body.status && current.status !== body.status && !!STATUS[body.status];
  let notification = 'not_needed';
  if (statusChanged || (current.status === 'shipped' && trackingChanged)) {
    const nextStatus = body.status || current.status;
    const detail = [shipping.carrier && `Courier: ${shipping.carrier}`, shipping.trackingNumber && `Tracking: ${shipping.trackingNumber}`].filter(Boolean).join('\n');
    const message = STATUS[nextStatus] || 'Your delivery tracking details have been updated.';
    try {
      await mail(current.customer.email, `Order ${ref}: ${nextStatus} update`, orderMail({ ...current, status: nextStatus, shipping }, message + (detail ? `\n\n${detail}` : '')));
      notification = 'sent';
    } catch (error) {
      notification = 'failed';
      console.error('[orders] status email failed', error);
    }
  }
  return { ...updated, notification, customerEmailSent: notification === 'sent' };
});
