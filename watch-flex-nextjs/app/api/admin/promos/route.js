import { handler, readBody, clean } from '@/lib/util';
import { requireAdmin } from '@/lib/auth';
import { getDb, saveDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const POST = handler(async (req) => {
  requireAdmin(req);
  const db = getDb();
  const b = await readBody(req);
  const code = clean(b.code, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!code || !(+b.value > 0)) throw 'Enter a code and a value above 0.';
  const type = b.type === 'fixed' ? 'fixed' : 'percent';
  if (type === 'percent' && +b.value > 100) throw 'A percentage cannot be above 100.';
  const old = db.promos.find((x) => x.code === code);
  const p = { code, type, value: +b.value, min: +b.min || 0, max: +b.max || 0, used: old ? old.used : 0, active: b.active !== false };
  if (old) Object.assign(old, p); else db.promos.push(p);
  saveDb();
  return p;
});
