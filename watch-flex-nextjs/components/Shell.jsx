'use client';
import Header from './Header';
import Footer from './Footer';
import PageFx from './PageFx';
import { useShop } from './ShopProvider';

export default function Shell({ children }) {
  const { status } = useShop();
  return (
    <>
      <div id="tr" aria-hidden="true">WATCH FLEX PK®</div>
      <a className="skip" href="#app" onClick={(e) => { e.preventDefault(); document.getElementById('app')?.focus(); }}>Skip to content</a>
      <div className="cur" id="cur"></div>
      <div className="vh" id="st" role="status" aria-live="polite">{status}</div>
      <Header />
      <main id="app" tabIndex={-1}>
        {children}
        <Footer />
      </main>
      <PageFx />
    </>
  );
}
