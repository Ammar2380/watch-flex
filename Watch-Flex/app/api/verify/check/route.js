import { handler, readBody, clean, EMAIL } from '@/lib/util';
import { tok, hashCode } from '@/lib/auth';
import { consumeEmailCode } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const POST = handler(async (req) => {
  const body = await readBody(req);
  const email = clean(body.email, 120).toLowerCase();
  const code = clean(body.code, 10);
  if (!EMAIL.test(email) || !/^\d{6}$/.test(code)) throw 'Enter the six-digit code sent to your email.';
  const status = await consumeEmailCode(email, hashCode(email, code));
  if (status === 'expired') throw 'This code has expired. Please request a new one.';
  if (status === 'rate_limited') throw 'Too many attempts. Please request a new code.';
  if (status !== 'ok') throw 'That code is not correct.';
  return { token: tok(email) };
});
