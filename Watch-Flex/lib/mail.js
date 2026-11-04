import nodemailer from 'nodemailer';
import { pkr } from './util';

const FROM = process.env.MAIL_FROM?.trim();
const G = globalThis;
if (G.__wfTx === undefined) {
  G.__wfTx = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
      })
    : null;
}

export const mailConfigured = () => !!(G.__wfTx && FROM);
export async function verifyMailConnection() {
  if (!G.__wfTx) throw new Error('SMTP_HOST, SMTP_USER and SMTP_PASS must be configured.');
  if (!FROM || !FROM.includes('@')) throw new Error('MAIL_FROM must be set to a verified sender address.');
  await G.__wfTx.verify();
  return true;
}
export async function mail(to, subject, text) {
  if (!G.__wfTx) throw new Error('Email service is not configured. Add SMTP_HOST, SMTP_USER and SMTP_PASS; messages are not sent without them.');
  if (!FROM || !FROM.includes('@')) throw new Error('MAIL_FROM must be set to a verified sender address.');
  return G.__wfTx.sendMail({ from: FROM, to, subject, text });
}

const itemLines = (o) => (o.items || []).map((i, k) => `${k + 1}. ${i.name} x${i.qty} - ${pkr(i.price * i.qty)}`).join('\n');
export const orderMail = (o, head) =>
  `Hello ${o.customer.name},\n\n${head}\n\nOrder ${o.ref}\n${itemLines(o)}\n` +
  (o.discount ? `Promo ${o.promo}: -${pkr(o.discount)}\n` : '') +
  ((Number(o.deliveryFee ?? o.delivery_fee ?? 0) > 0) ? `Delivery: ${pkr(o.deliveryFee ?? o.delivery_fee)}\n` : '') +
  `Total: ${pkr(o.total)} (${o.payment || 'cash on delivery'})\n\nDelivery to:\n${o.customer.address}, ${o.customer.city} ${o.customer.postal}\nPhone: ${o.customer.phone}\n\nThank you for shopping with Watch Flex PK.`;

export const STATUS = {
  confirmed: 'Your order is confirmed. We are getting it ready.',
  shipped: 'Good news - your order has been dispatched.',
  delivered: 'Your order has been delivered. We hope you love it!',
  cancelled: 'Your order has been cancelled. Contact us if this is a mistake.',
};
