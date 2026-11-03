import { handler } from '@/lib/util';
import { requireAdmin } from '@/lib/auth';
import { getDb, saveDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const DELETE = handler(async (req, ctx) => {
  requireAdmin(req);
  const { code } = await ctx.params;
  const db = getDb();
  db.promos = db.promos.filter((x) => x.code !== code);
  saveDb();
  return { ok: true };
});
