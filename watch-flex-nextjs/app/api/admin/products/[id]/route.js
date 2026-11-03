import { handler } from '@/lib/util';
import { requireAdmin } from '@/lib/auth';
import { getDb, saveDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const DELETE = handler(async (req, ctx) => {
  requireAdmin(req);
  const { id } = await ctx.params;
  const db = getDb();
  db.products = db.products.filter((x) => x.id !== id);
  saveDb();
  return { ok: true };
});
