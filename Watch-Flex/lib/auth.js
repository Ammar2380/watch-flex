import crypto from 'node:crypto';
import { HttpError } from './util.js';

const production = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
function getSecret() {
  const configured = process.env.SECRET;
  if (configured && configured.length >= 32 && !/^(generate-at-least|replace-me|change-me|example-secret)/i.test(configured)) return configured;
  if (production) throw new Error('SECRET must be configured with at least 32 characters in production.');
  return (globalThis.__wfDevSecret ||= crypto.randomBytes(32).toString('hex'));
}

export const adminPassword = () => {
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 16 || /^(use-a-unique|change-me|your-password)/i.test(process.env.ADMIN_PASSWORD)) {
    throw new Error('ADMIN_PASSWORD must be configured with at least 16 characters before the admin panel can be used.');
  }
  return process.env.ADMIN_PASSWORD;
};

const sign = (value) => crypto.createHmac('sha256', getSecret()).update(value).digest('hex');
export const tok = (who, ms = 30 * 60e3) => {
  const e = Date.now() + ms;
  return `${e}.${sign(`${who}.${e}`)}`;
};
export const okTok = (who, token) => {
  const [expiry, signature] = String(token || '').split('.');
  if (!/^\d+$/.test(expiry || '') || !signature || Number(expiry) <= Date.now()) return false;
  const expected = sign(`${who}.${expiry}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
export const hashCode = (email, code) => crypto.createHmac('sha256', getSecret()).update(`${email}:${code}`).digest('hex');
export const safePasswordEqual = (provided) => {
  const expected = adminPassword();
  const a = crypto.createHash('sha256').update(String(provided ?? '')).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
};
export function requireAdmin(req) {
  if (!okTok('admin', req.headers.get('x-admin-token'))) throw new HttpError(401, 'Please log in again.');
}
