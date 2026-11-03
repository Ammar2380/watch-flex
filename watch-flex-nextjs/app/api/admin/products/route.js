import { handler, readBody, clean } from '@/lib/util';
import { requireAdmin } from '@/lib/auth';
import { getDb, saveDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const POST = handler(async (req) => {
  requireAdmin(req);
  const db = getDb();
  const b = await readBody(req);
  const name = clean(b.name, 120);
  if (!name || !(+b.price >= 0)) throw 'Name and a valid price are required.';
  const slug = 'f-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const p = {
    id: clean(b.id, 80) || slug + '-' + Date.now().toString(36).slice(-3),
    name,
    brand: clean(b.brand, 60),
    model: clean(b.model, 60),
    price: Math.round(+b.price),
    images: (b.images || []).map((u) => clean(u, 500)).filter(Boolean),
    category: clean(b.category, 60) || 'Watches',
    specs: (b.specs || []).map((x) => clean(x, 60)).filter(Boolean),
    stock: ['in', 'out', 'unknown'].includes(b.stock) ? b.stock : 'unknown',
    featured: !!b.featured,
    isNew: !!b.isNew,
  };
  const i = db.products.findIndex((x) => x.id === p.id);
  if (i < 0) db.products.push(p); else db.products[i] = p;
  saveDb();
  return p;
});
