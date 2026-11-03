import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { pkr } from './util';

const FROM = process.env.MAIL_FROM || 'Watch Flex PK <no-reply@watchflex.pk>';
const G = globalThis;
if (G.__wfTx === undefined) {
  G.__wfTx = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: +process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_PORT === '465',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })
    : null;
  if (!G.__wfTx) console.log('[mail] SMTP is not configured: emails are printed here and saved to outbox.log');
}

export async function mail(to, subject, text) {
  const tx = G.__wfTx;
  if (!tx) {
    const l = `\n--- EMAIL (SMTP not configured: not really sent) ---\nTo: ${to}\nSubject: ${subject}\n${text}\n`;
    console.log(l);
    try { fs.appendFileSync(path.join(process.cwd(), 'outbox.log'), l); } catch {}
    return;
  }
  await tx.sendMail({ from: FROM, to, subject, text });
}

const itemLines = (o) => o.items.map((i, k) => `${k + 1}. ${i.name} x${i.qty} - ${pkr(i.price * i.qty)}`).join('\n');
export const orderMail = (o, head) =>
  `Hello ${o.customer.name},\n\n${head}\n\nOrder ${o.ref}\n${itemLines(o)}\n` +
  (o.discount ? `Promo ${o.promo}: -${pkr(o.discount)}\n` : '') +
  `Total: ${pkr(o.total)} (cash on delivery)\n\nDelivery to:\n${o.customer.address}, ${o.customer.city} ${o.customer.postal}\nPhone: ${o.customer.phone}\n\nThank you for shopping with Watch Flex PK.`;

export const STATUS = {
  confirmed: 'Your order is confirmed. We are getting it ready.',
  shipped: 'Good news - your order has been shipped.',
  delivered: 'Your order has been delivered. We hope you love it!',
  cancelled: 'Your order has been cancelled. Contact us if this is a mistake.',
};
