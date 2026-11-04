'use client';
import { NavLink } from './ShopProvider';
import { DEL, IG, WA } from '@/lib/site';

export default function Footer() {
  return (
    <footer>
      <div className="ln"></div>
      <div className="fh">
        <p className="big">Your Style. Your Time.<br /><span>Your Flex.</span></p>
        <div className="c26" aria-hidden="true">©26</div>
      </div>
      <p className="fp">Cash on delivery all over Pakistan. Delivery in {DEL} days.</p>
      <div className="ln1"></div>
      <div className="fc">
        <div><b>Watch Flex PK</b>Your Style. Your Time. Your Flex.<br />All rights reserved © 2026</div>
        <div><b>Quick links</b><NavLink href="/">Shop</NavLink><NavLink href="/bag">Bag</NavLink></div>
        <div>
          <b>Customer care</b>
          <NavLink href="/shipping">Shipping &amp; returns</NavLink>
          <NavLink href="/privacy">Privacy policy</NavLink>
          <a href={'https://wa.me/' + WA} target="_blank" rel="noopener">Contact on WhatsApp</a>
        </div>
        <div>
          <b>Follow us</b>
          <a href={IG} target="_blank" rel="noopener">Instagram</a>
          <a href={'https://wa.me/' + WA} target="_blank" rel="noopener">WhatsApp</a>
        </div>
      </div>
    </footer>
  );
}
