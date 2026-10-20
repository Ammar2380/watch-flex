import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { Check } from 'lucide-react';
import { MAX_CART_QTY } from './config';
import { products } from './data/products';
import type { CartItem, CartLine, Product } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import IntroSequence from './components/IntroSequence';
import { Header } from './components/Sections';
import Hero from './components/Hero';
import Strip from './components/Strip';
import Banner from './components/Banner';
import { Footer } from './components/Footer';
import ProductCatalog from './components/ProductCatalog';
import QuickView from './components/QuickView';
import BagDrawer from './components/BagDrawer';

const byId = new Map(products.map(p => [p.id, p]));
const validCart = (v: unknown) => Array.isArray(v)
  && v.every(i => i && Number.isInteger(i.id) && Number.isInteger(i.qty) && i.qty > 0);
const validIds = (v: unknown) => Array.isArray(v) && v.every(id => Number.isInteger(id) && byId.has(id)) && new Set(v).size === v.length;

export default function App() {
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('wf-theme', 'light', v => v === 'light' || v === 'dark');
  const [cart, setCart] = useLocalStorage<CartItem[]>('wf-cart', [], validCart);
  const [wish, setWish] = useLocalStorage<number[]>('wf-wish', [], validIds);
  const [intro, setIntro] = useState(() => {
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return false;
    try { return !sessionStorage.getItem('wf-intro'); } catch { return true; }
  });
  const [bagOpen, setBagOpen] = useState(false);
  const [quick, setQuick] = useState<Product | null>(null);
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);

  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); }, [theme]);
  useEffect(() => {
    // Migrate legacy cart entries safely: drop removed products, merge duplicate IDs and clamp old quantities.
    setCart(current => {
      let changed = false;
      const normalized = current.reduce<CartItem[]>((items, item) => {
        if (!byId.has(item.id)) { changed = true; return items; }
        const previous = items.find(line => line.id === item.id);
        if (previous) {
          previous.qty = Math.min(MAX_CART_QTY, previous.qty + item.qty);
          changed = true;
          return items;
        }
        const qty = Math.min(MAX_CART_QTY, item.qty);
        if (qty !== item.qty) changed = true;
        items.push({ id: item.id, qty });
        return items;
      }, []);
      return changed ? normalized : current;
    });
  }, [setCart]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Single source of truth: totals are derived from the catalogue, never stored.
  const lines = useMemo<CartLine[]>(() => cart.flatMap(c => { const p = byId.get(c.id); return p ? [{ product: p, qty: c.qty }] : []; }), [cart]);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);

  const add = (id: number, qty = 1) => {
    const product = byId.get(id);
    if (!product || !Number.isFinite(qty) || qty <= 0) return;
    const increment = Math.min(MAX_CART_QTY, Math.max(1, Math.trunc(qty)));
    setCart(c => {
      const current = c.find(i => i.id === id);
      if (current) return c.map(i => i.id === id ? { ...i, qty: Math.min(MAX_CART_QTY, current.qty + increment) } : i);
      return [...c, { id, qty: increment }];
    });
    setToast({ id: Date.now(), msg: `Added "${product.name}" to your bag` });
  };
  const setQty = (id: number, qty: number) => setCart(c => {
    if (!Number.isFinite(qty)) return c;
    if (qty <= 0) return c.filter(i => i.id !== id);
    const safeQty = Math.min(MAX_CART_QTY, Math.max(1, Math.trunc(qty)));
    return c.map(i => i.id === id ? { ...i, qty: safeQty } : i);
  });
  const toggleWish = (id: number) => setWish(w => (w.includes(id) ? w.filter(x => x !== id) : [...w, id]));
  const endIntro = useCallback(() => { try { sessionStorage.setItem('wf-intro', '1'); } catch { /* ignore */ } setIntro(false); }, []);
  const closeQuick = useCallback(() => setQuick(null), []);
  const closeBag = useCallback(() => setBagOpen(false), []);

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>{intro && <IntroSequence onDone={endIntro} />}</AnimatePresence>
      <Header count={count} dark={theme === 'dark'} onBag={() => setBagOpen(true)} onTheme={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))} />
      <Hero ready={!intro} />
      <Strip products={products} onQuick={setQuick} />
      <ProductCatalog products={products} wish={wish} onQuick={setQuick} onWish={toggleWish} />
      <Banner />
      <Footer />

      <AnimatePresence>
        {quick && <QuickView key={quick.id} product={quick} wished={wish.includes(quick.id)} onClose={closeQuick}
          onAdd={qty => { add(quick.id, qty); setQuick(null); }} onWish={() => toggleWish(quick.id)} />}
      </AnimatePresence>
      <AnimatePresence>
        {bagOpen && <BagDrawer lines={lines} count={count} subtotal={subtotal} onQty={setQty} onClose={closeBag} onOrderAccepted={() => setCart([])} />}
      </AnimatePresence>

      <div role="status" aria-live="polite" aria-atomic="true" className="fixed bottom-4 left-4 right-4 sm:bottom-6 sm:left-auto sm:right-6 z-[60] pointer-events-none">
        <AnimatePresence>
          {toast && (
            <motion.div key={toast.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
              className="ml-auto w-fit max-w-full bg-brandRed text-white px-4 sm:px-6 py-3 rounded-lg shadow-2xl font-medium text-sm flex items-center gap-3 break-words">
              <Check size={16} className="shrink-0" /><span className="min-w-0 [overflow-wrap:anywhere]">{toast.msg}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
