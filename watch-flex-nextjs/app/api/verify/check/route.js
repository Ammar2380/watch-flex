import { handler, readBody, clean } from '@/lib/util';
import { tok } from '@/lib/auth';

export const dynamic = 'force-dynamic';
const codes = (globalThis.__wfCodes ||= new Map());

export const POST = handler(async (req) => {
  const body = await readBody(req);
  const email = clean(body.email, 120).toLowerCase();
  const c = codes.get(email);
  if (!c || c.exp < Date.now()) throw 'This code has expired. Please request a new one.';
  if (++c.tries > 5) { codes.delete(email); throw 'Too many attempts. Please request a new code.'; }
  if (clean(body.code, 10) !== c.code) throw 'That code is not correct.';
  codes.delete(email);
  return { token: tok(email) };
});
