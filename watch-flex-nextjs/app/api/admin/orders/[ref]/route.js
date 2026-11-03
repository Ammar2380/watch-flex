import { handler, readBody } from '@/lib/util';
import { requireAdmin } from '@/lib/auth';
import { getDb, saveDb } from '@/lib/db';
import { mail, orderMail, STATUS } from '@/lib/mail';

export const dynamic = 'force-dynamic';

export const PUT = handler(async (req, ctx) => {
  requireAdmin(req);
  const { ref } = await ctx.params;
  const db = getDb();
  const o = db.orders.find((x) => x.ref === ref);
  const s = (await readBody(req)).status;
  if (!o || !['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(s)) throw 'Invalid order or status.';
  const changed = o.status !== s;
  o.status = s;
  saveDb();
  if (changed && STATUS[s]) mail(o.customer.email, `Order ${o.ref}: ${s}`, orderMail(o, STATUS[s])).catch(console.error);
  return o;
});
