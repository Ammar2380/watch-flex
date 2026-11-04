import { handler } from '@/lib/util';
import { requireAdmin } from '@/lib/auth';
import { getDb, deleteProduct } from '@/lib/db';
import { deleteProductImageByUrl } from '@/lib/storage';
export const dynamic = 'force-dynamic';
export const DELETE = handler(async (req, ctx) => {
  requireAdmin(req);
  const { id } = await ctx.params;
  const db = await getDb();
  const product = db.products.find((p) => p.id === id);
  await deleteProduct(id);
  await Promise.allSettled((product?.images || []).map((url) => deleteProductImageByUrl(url)));
  return { ok: true };
});
