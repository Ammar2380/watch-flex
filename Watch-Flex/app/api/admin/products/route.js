import { handler, readBody, clean } from '@/lib/util';
import { requireAdmin } from '@/lib/auth';
import { getDb, saveProduct } from '@/lib/db';
import { deleteProductImageByUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const POST = handler(async (req) => {
  requireAdmin(req);
  const b = await readBody(req);
  const name = clean(b.name, 120);
  if (!name || !(Number(b.price) > 0) || !Number.isFinite(Number(b.price))) throw 'Name and a valid price above 0 are required.';
  const slug = 'f-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const id = clean(b.id, 80) || `${slug}-${Date.now().toString(36).slice(-5)}`;
  const images = Array.isArray(b.images) ? b.images.map((u) => clean(u, 1000)).filter((u) => /^https:\/\//i.test(u)).slice(0, 12) : [];
  const stockRaw = b.stockQuantity === '' || b.stockQuantity == null ? null : Number(b.stockQuantity);
  if (stockRaw !== null && (!Number.isInteger(stockRaw) || stockRaw < 0)) throw 'Stock quantity must be a whole number of zero or more.';
  const product = {
    id, name, brand: clean(b.brand, 60), model: clean(b.model, 60), price: Math.round(Number(b.price)),
    images, category: clean(b.category, 60) || 'Watches',
    specs: Array.isArray(b.specs) ? b.specs.map((x) => clean(x, 60)).filter(Boolean).slice(0, 30) : [],
    stock: stockRaw !== null ? (stockRaw > 0 ? 'in' : 'out') : (['in', 'out', 'unknown'].includes(b.stock) ? b.stock : 'unknown'),
    stockQuantity: stockRaw,
    featured: !!b.featured, isNew: !!b.isNew,
  };
  const db = await getDb();
  const old = db.products.find((p) => p.id === id);
  const saved = await saveProduct(product);
  if (old) {
    const removed = (old.images || []).filter((url) => !images.includes(url));
    await Promise.allSettled(removed.map((url) => deleteProductImageByUrl(url)));
  }
  return saved;
});
