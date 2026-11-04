'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { normalize } from '@/lib/catalog';

const Ctx = createContext(null);
export const useShop = () => useContext(Ctx);

const THEME_COLORS = { black: '#000000', cream: '#ece5dc', navy: '#ece5dc' };
export const INITIAL_FILTERS = { q: '', brands: [], categories: [], min: '', max: '', sort: 'featured', shown: 16 };

const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

export default function ShopProvider({ products, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const items = useMemo(() => normalize(products), [products]);
  const map = useMemo(() => new Map(items.map((p) => [p.id, p])), [items]);

  /* ---------- cart (kept on the visitor's own device) ---------- */
  const [cart, setCartState] = useState({});
  const cartRef = useRef({});
  const cartReady = useRef(false);
  const [status, setStatus] = useState('');
  const say = useCallback((t) => setStatus(t), []);
  const setCart = useCallback((next) => { cartRef.current = next; setCartState(next); }, []);

  useEffect(() => {
    const out = {};
    try {
      const c = JSON.parse(lsGet('wf-cart') || lsGet('of-cart') || '{}') || {};
      for (const k in c) {
        const q = Math.floor(+c[k]);
        if (map.has(k) && q > 0) out[k] = Math.min(q, 99);
      }
    } catch {}
    cartReady.current = true;
    setCart(out);
  }, [map, setCart]);
  useEffect(() => { if (cartReady.current) lsSet('wf-cart', JSON.stringify(cart)); }, [cart]);

  const cnt = useMemo(() => Object.values(cart).reduce((a, b) => a + b, 0), [cart]);
  const rowsOf = useCallback(() => Object.entries(cart).map(([id, q]) => [map.get(id), q]).filter((r) => r[0]), [cart, map]);
  const okRows = useCallback(() => rowsOf().filter((r) => r[0].stock !== 'out'), [rowsOf]);

  const addToCart = useCallback((id) => {
    const p = map.get(id);
    if (!p || p.stock === 'out') return;
    const cur = cartRef.current;
    const next = { ...cur, [id]: Math.min(99, (cur[id] || 0) + 1) };
    setCart(next);
    say(`${p.name} added. ${Object.values(next).reduce((a, b) => a + b, 0)} in your bag.`);
  }, [map, setCart, say]);
  const changeQty = useCallback((id, d) => {
    const cur = { ...cartRef.current };
    if (!(id in cur)) return;
    cur[id] += d;
    if (cur[id] > 99) cur[id] = 99;
    if (cur[id] < 1) delete cur[id];
    setCart(cur);
  }, [setCart]);
  const removeFromCart = useCallback((id) => {
    const cur = { ...cartRef.current };
    delete cur[id];
    setCart(cur);
  }, [setCart]);
  const removeMany = useCallback((ids) => {
    const cur = { ...cartRef.current };
    ids.forEach((id) => delete cur[id]);
    setCart(cur);
  }, [setCart]);

  /* ---------- theme ---------- */
  const [theme, setThemeState] = useState(null);
  useEffect(() => {
    let t = lsGet('of-theme');
    if (t === 'red') t = 'navy';
    setThemeState(THEME_COLORS[t] ? t : 'black');
  }, []);
  useEffect(() => {
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
    lsSet('of-theme', theme);
    const m = document.querySelector('meta[name=theme-color]');
    if (m) m.setAttribute('content', THEME_COLORS[theme]);
  }, [theme]);
  const setTheme = useCallback((t) => { if (THEME_COLORS[t]) setThemeState(t); }, []);

  /* ---------- catalogue filters (kept while you open a watch and come back) ---------- */
  const [filters, setFiltersState] = useState(INITIAL_FILTERS);
  const setFilters = useCallback((patch) => {
    setFiltersState((f) => ({ ...f, ...(patch.shown === undefined ? { shown: INITIAL_FILTERS.shown } : {}), ...patch }));
  }, []);

  /* ---------- motion: GSAP + Lenis (loaded in the browser only) ---------- */
  const fx = useRef({ gsap: null, ScrollTrigger: null, lenis: null });
  const [motionReady, setMotionReady] = useState(false);
  const RM = useRef(false);
  const stillRef = useRef(false);

  useEffect(() => {
    RM.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Do not start smooth scrolling or GSAP motion for visitors who request reduced motion.
    if (RM.current) { setMotionReady(true); return undefined; }
    let dead = false, lenis = null, onMove = null, tickerFn = null, gsapRef = null;
    (async () => {
      try {
        const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
          import('gsap'), import('gsap/ScrollTrigger'), import('lenis'),
        ]);
        if (dead) return;
        gsapRef = gsap;
        gsap.registerPlugin(ScrollTrigger);
        lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
        lenis.on('scroll', ScrollTrigger.update);
        tickerFn = (t) => lenis?.raf(t * 1000);
        gsap.ticker.add(tickerFn);
        gsap.ticker.lagSmoothing(0);
        fx.current = { gsap, ScrollTrigger, lenis };
        // Dot cursor is restricted to precise mouse/trackpad pointers.
        if (window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
          const c = document.getElementById('cur');
          if (c) {
            const cx = gsap.quickTo(c, 'x', { duration: 0.18, ease: 'power3' });
            const cy = gsap.quickTo(c, 'y', { duration: 0.18, ease: 'power3' });
            onMove = (e) => { c.style.opacity = 1; cx(e.clientX); cy(e.clientY); };
            window.addEventListener('mousemove', onMove, { passive: true });
          }
        }
        setMotionReady(true);
      } catch (e) {
        // Motion is an enhancement; the storefront remains fully usable without it.
        console.warn('Motion libraries not loaded; the site works without them.', e);
        setMotionReady(true);
      }
    })();
    return () => {
      dead = true;
      if (onMove) window.removeEventListener('mousemove', onMove);
      if (gsapRef && tickerFn) gsapRef.ticker.remove(tickerFn);
      if (lenis) lenis.destroy();
      fx.current = { gsap: null, ScrollTrigger: null, lenis: null };
    };
  }, []);

  /* ---------- navigation with the sliding panel ---------- */
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const shopY = useRef(0);
  const prevPath = useRef(null);
  const busy = useRef(false);
  const navWait = useRef(null);

  const scrollTo = useCallback((y, immediate) => {
    const { lenis } = fx.current;
    if (lenis) {
      if (lenis.resize) lenis.resize();
      lenis.scrollTo(y, immediate ? { immediate: true, force: true } : undefined);
    } else window.scrollTo(0, y);
  }, []);
  const scrollTop = useCallback(() => scrollTo(0, true), [scrollTo]);

  const go = useCallback((href) => {
    const cur = pathRef.current;
    if (cur === '/') shopY.current = window.scrollY;
    if (busy.current) return;
    if (href === cur) {
      const { lenis } = fx.current;
      lenis ? lenis.scrollTo(0) : window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const { gsap, lenis } = fx.current;
    if (!gsap || RM.current) { router.push(href, { scroll: false }); return; }
    busy.current = true;
    stillRef.current = true;
    lenis && lenis.stop();
    const end = () => {
      busy.current = false;
      lenis && lenis.start();
      gsap.set('#tr', { visibility: 'hidden', yPercent: 100 });
    };
    const tl = gsap.timeline({ onComplete: end, onInterrupt: end });
    tl.set('#tr', { yPercent: 100, visibility: 'visible' })
      .to('#tr', { yPercent: 0, duration: 0.35, ease: 'power2.inOut' })
      .add(() => {
        tl.pause();
        let done = false;
        const resume = () => { if (!done) { done = true; navWait.current = null; tl.play(); } };
        navWait.current = resume;
        router.push(href, { scroll: false });
        setTimeout(resume, 2500); // never leave the panel stuck if the page is slow
      })
      .to('#tr', { yPercent: -100, duration: 0.35, ease: 'power2.inOut', delay: 0.06 });
  }, [router]);

  // restore scroll after every route change, move focus to the new page title
  useEffect(() => {
    const prev = prevPath.current;
    prevPath.current = pathname;
    if (prev === null) return; // first load
    const back = pathname === '/' && prev.startsWith('/p/') && shopY.current > 0;
    scrollTo(back ? shopY.current : 0, true);
    const t = document.querySelector('#app h1');
    if (t) { t.tabIndex = -1; t.focus({ preventScroll: true }); }
    requestAnimationFrame(() => { if (navWait.current) navWait.current(); });
  }, [pathname, scrollTo]);

  // old links like /#bag or /#p-some-watch keep working
  useEffect(() => {
    const h = decodeURIComponent(window.location.hash.slice(1) || '');
    if (!h) return;
    const m = { shop: '/', bag: '/bag', checkout: '/checkout', shipping: '/shipping', privacy: '/privacy' };
    if (m[h] && m[h] !== window.location.pathname) router.replace(m[h]);
    else if (h.startsWith('p-')) router.replace('/p/' + encodeURIComponent(h.slice(2)));
  }, [router]);

  const value = {
    items, map, cart, cnt, rowsOf, okRows, addToCart, changeQty, removeFromCart, removeMany,
    theme, setTheme, say, status, filters, setFilters, go, scrollTop, fx, motionReady, RM, stillRef, pathname,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Link that plays the page transition. Cmd/Ctrl/Shift-click still opens normally. */
export function NavLink({ href, children, onClick, ...rest }) {
  const { go } = useShop();
  return (
    <Link
      href={href}
      {...rest}
      onClick={(e) => {
        if (onClick) onClick(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        go(href);
      }}
    >
      {children}
    </Link>
  );
}
