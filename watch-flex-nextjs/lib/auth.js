import crypto from 'crypto';
import { HttpError } from './util';

const G = globalThis;
if (!G.__wfAuth) {
  let admin = process.env.ADMIN_PASSWORD;
  if (!admin) {
    admin = crypto.randomBytes(5).toString('hex');
    console.log('ADMIN_PASSWORD is not set. Temporary admin password:', admin);
  }
  G.__wfAuth = { secret: process.env.SECRET || crypto.randomBytes(24).toString('hex'), admin };
}
const A = G.__wfAuth;

export const adminPassword = () => A.admin;
const sign = (s) => crypto.createHmac('sha256', A.secret).update(s).digest('hex');

/** Signed, expiring tokens (email verification + admin session) */
export const tok = (who, ms = 30 * 60e3) => {
  const e = Date.now() + ms;
  return e + '.' + sign(who + e);
};
export const okTok = (who, t) => {
  const [e, h] = String(t || '').split('.');
  return +e > Date.now() && h === sign(who + e);
};
export function requireAdmin(req) {
  if (!okTok('admin', req.headers.get('x-admin-token'))) throw new HttpError(401, 'Please log in again.');
}
