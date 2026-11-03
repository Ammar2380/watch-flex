import crypto from 'crypto';
import { handler, readBody, clean, EMAIL } from '@/lib/util';

import { mail } from '@/lib/mail';

export const dynamic = 'force-dynamic';
const codes = (globalThis.__wfCodes ||= new Map());

export const POST = handler(async (req) => {
  const body = await readBody(req);
  const email = clean(body.email, 120).toLowerCase();
  if (!EMAIL.test(email)) throw 'Enter a valid email address.';
  const c = codes.get(email) || { sent: [] };
  c.sent = c.sent.filter((t) => t > Date.now() - 36e5);
  if (c.sent.length >= 5) throw 'Too many codes requested. Please try again in an hour.';
  c.code = String(crypto.randomInt(100000, 1000000));
  c.exp = Date.now() + 10 * 60e3;
  c.tries = 0;
  c.sent.push(Date.now());
  codes.set(email, c);
  await mail(email, 'Your Watch Flex verification code',
    `Your verification code is ${c.code}\n\nIt expires in 10 minutes. If you did not request it, ignore this email.`);
  return { ok: true };
});
