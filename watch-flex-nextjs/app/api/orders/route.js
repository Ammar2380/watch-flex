import { handler, readBody, clean, pkr } from '@/lib/util';
import { okTok } from '@/lib/auth';
import { getDb, saveDb } from '@/lib/db';
import { promoFor } from '@/lib/promo';
import { mail, orderMail } from '@/lib/mail';

export const dynamic = 'force-dynamic';

export const POST = handler(async (req) => {
  const db = getDb();
  const { items, customer: c = {}, promo, token } = await readBody(req);
  const email = clean(c.email, 120).toLowerCase();
  if (!Array.isArray(items) || !items.length || items.length > 30) throw 'Your bag is empty.';
  if (!okTok(email, token)) throw 'Please verify your email first.';
  for (const k of ['name', 'phone', 'city', 'postal', 'address']) {
    if (clean(c[k]).length < 2) throw 'Please fill in all delivery details.';
  }
  const rows = items.map((i) => {
    const p = db.products.find((x) => x.id === i.id);
    const q = Math.floor(+i.qty);
    if (!p || p.stock === 'out' || !(q >= 1 && q <= 99)) throw 'An item in your bag is no longer available.';
    return { id: p.id, name: p.name, price: p.price, qty: q };
  });
  const subtotal = rows.reduce((a, r) => a + r.price * r.qty, 0);
  let discount = 0, code = '';
  if (promo) { const r = promoFor(promo, subtotal); discount = r.discount; code = r.p.code; r.p.used++; }
  const order = {
    ref: 'WF-' + (1001 + db.orders.length),
    date: new Date().toISOString(),
    status: 'pending',
    customer: {
      name: clean(c.name, 80), phone: clean(c.phone, 30), email, city: clean(c.city, 60),
      postal: clean(c.postal, 10), address: clean(c.address, 300), notes: clean(c.notes, 400),
    },
    items: rows, subtotal, discount, promo: code, total: subtotal - discount, payment: 'Cash on delivery',
  };
  db.orders.unshift(order);
  saveDb();
  mail(email, `Order ${order.ref} confirmed - Watch Flex PK`,
    orderMail(order, 'Thank you! Your order is confirmed. We will contact you to arrange delivery.')).catch(console.error);
  if (process.env.ADMIN_EMAIL) {
    mail(process.env.ADMIN_EMAIL, `New order ${order.ref} - ${pkr(order.total)}`,
      orderMail(order, 'A new order was placed.') + `\nNotes: ${order.customer.notes || '-'}`).catch(console.error);
  }
  return { ref: order.ref, discount, total: order.total };
});
