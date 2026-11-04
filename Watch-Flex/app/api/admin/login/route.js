import { handler, readBody, clean } from '@/lib/util';
import { safePasswordEqual, tok, hashCode } from '@/lib/auth';
import { checkRateLimit, resetRateLimit } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const POST = handler(async (req) => {
  const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const subject = hashCode('admin-login', ip);
  if (await checkRateLimit('admin-login', subject, 5, 900, 900) !== 'ok') throw 'Too many login attempts. Try again in 15 minutes.';
  const body = await readBody(req);
  const ok = safePasswordEqual(clean(body.password, 200));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 500));
    throw 'Wrong password.';
  }
  await resetRateLimit('admin-login', subject);
  return { token: tok('admin', 8 * 36e5) };
});
