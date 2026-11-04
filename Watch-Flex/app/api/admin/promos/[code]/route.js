import { handler } from '@/lib/util';
import { requireAdmin } from '@/lib/auth';
import { deletePromo } from '@/lib/db';
export const dynamic = 'force-dynamic';
export const DELETE = handler(async (req, ctx) => {
  requireAdmin(req);
  const { code } = await ctx.params;
  await deletePromo(code.toUpperCase());
  return { ok: true };
});
