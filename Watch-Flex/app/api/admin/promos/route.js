import { handler, readBody, clean } from '@/lib/util';
import { requireAdmin } from '@/lib/auth';
import { getDb, savePromo } from '@/lib/db';
export const dynamic = 'force-dynamic';
export const POST = handler(async (req) => {
  requireAdmin(req);
  const b = await readBody(req);
  const code = clean(b.code, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!code || !(Number(b.value) > 0) || !Number.isFinite(Number(b.value))) throw 'Enter a code and a value above 0.';
  const type = b.type === 'fixed' ? 'fixed' : 'percent';
  if (type === 'percent' && Number(b.value) > 100) throw 'A percentage cannot be above 100.';
  const db = await getDb();
  const old = db.promos.find((p) => p.code === code);
  return savePromo({ code, type, value: Math.round(Number(b.value)), min: Math.max(0, Math.round(Number(b.min) || 0)), max: Math.max(0, Math.floor(Number(b.max) || 0)), used: old?.used || 0, active: b.active !== false });
});
