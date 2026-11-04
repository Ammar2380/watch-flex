import crypto from 'node:crypto';
import { handler, readBody, clean, EMAIL } from '@/lib/util';
import { hashCode } from '@/lib/auth';
import { issueEmailCode, invalidateEmailCode, checkRateLimit } from '@/lib/db';
import { mail } from '@/lib/mail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = handler(async (req) => {
  const body = await readBody(req);
  const email = clean(body.email, 120).toLowerCase();
  if (!EMAIL.test(email)) throw 'Enter a valid email address.';
  const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (await checkRateLimit('verify-send-ip', hashCode('verify-send-ip', ip), 20, 3600, 3600) !== 'ok') throw 'Too many verification requests from this connection. Try again in an hour.';
  const code = String(crypto.randomInt(100000, 1000000));
  const status = await issueEmailCode(email, hashCode(email, code));
  if (status !== 'ok') throw 'Too many codes requested. Please try again in an hour.';
  try {
    await mail(email, 'Your Watch Flex verification code', `Your verification code is ${code}\n\nIt expires in 10 minutes. You have up to five attempts. If you did not request it, ignore this email.`);
  } catch (error) {
    await invalidateEmailCode(email).catch(() => {});
    throw new Error(`Verification email could not be sent. ${error.message}`);
  }
  return { ok: true, expiresIn: 600 };
});
