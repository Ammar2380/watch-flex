'use client';
import { NavLink } from './ShopProvider';
import { DEL } from '@/lib/site';

export function InfoPage({ title, children }) {
  return (
    <section className="pg">
      <h1>{title}</h1>
      {children}
      <NavLink className="btn" href="/">Back to shop</NavLink>
    </section>
  );
}
export const Shipping = () => (
  <InfoPage title="Shipping & returns">
    <p>Cash on delivery all over Pakistan. Delivery time: {DEL} days. We confirm availability and delivery details with you after you place your order.</p>
  </InfoPage>
);
export const Privacy = () => (
  <InfoPage title="Privacy policy">
    <p>This website keeps your bag on your own device only. When you place an order, the details you enter are sent to us only to process and deliver it.</p>
  </InfoPage>
);
export const NotFoundWatch = () => (
  <InfoPage title="Watch not found">
    <p>This watch is no longer listed or the link is wrong.</p>
  </InfoPage>
);
