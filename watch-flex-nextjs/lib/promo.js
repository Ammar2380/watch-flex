import { getDb } from './db';
import { clean, pkr } from './util';

export function promoFor(code, sub) {
  const db = getDb();
  const p = db.promos.find((x) => x.code === clean(code, 40).toUpperCase());
  if (!p || !p.active) throw 'This promo code is not valid.';
  if (p.max && p.used >= p.max) throw 'This promo code has been fully used.';
  if (sub < p.min) throw `This code needs a minimum order of ${pkr(p.min)}.`;
  const discount = Math.min(sub, p.type === 'percent' ? Math.round((sub * p.value) / 100) : p.value);
  return { p, discount, label: p.type === 'percent' ? `${p.value}% off` : `${pkr(p.value)} off` };
}
