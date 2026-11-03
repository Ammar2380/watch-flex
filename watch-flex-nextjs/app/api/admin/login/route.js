import { handler, readBody, clean } from '@/lib/util';
import { adminPassword, tok } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const POST = handler(async (req) => {
  const body = await readBody(req);
  if (clean(body.password, 100) !== adminPassword()) {
    await new Promise((r) => setTimeout(r, 700));
    throw 'Wrong password.';
  }
  return { token: tok('admin', 8 * 36e5) };
});
