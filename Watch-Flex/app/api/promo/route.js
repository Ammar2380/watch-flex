import { handler, readBody } from '@/lib/util';
import { promoFor } from '@/lib/promo';

export const dynamic = 'force-dynamic';
export const POST = handler(async (req) => {
  const body = await readBody(req);
  const sub = Math.max(0, Number(body.subtotal) || 0);
  const r = await promoFor(body.code, sub);
  return { code: r.p.code, type: r.p.type, value: r.p.value, discount: r.discount, label: r.label };
});
