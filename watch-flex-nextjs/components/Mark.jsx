'use client';
import { NavLink } from './ShopProvider';

export default function Mark() {
  return (
    <>
      <div className="rule"></div>
      <div className="info">
        <span>WATCH FLEX PK</span>
        <NavLink className="sr" href="/shipping">SHIPPING &amp; RETURNS</NavLink>
        <span className="y">© 2026</span>
      </div>
    </>
  );
}
