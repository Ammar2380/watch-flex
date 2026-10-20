import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import type { CartLine } from '../types';
import { MAX_CART_QTY, money } from '../config';
import { useDialog } from '../hooks/useDialog';
import CheckoutForm from './CheckoutForm';

interface Props {
  lines: CartLine[]; count: number; subtotal: number;
  onQty: (id: number, qty: number) => void; onClose: () => void; onOrderAccepted: () => void;
}

export default function BagDrawer({ lines, count, subtotal, onQty, onClose, onOrderAccepted }: Props) {
  const ref = useDialog<HTMLElement>(onClose);
  const [view, setView] = useState<'bag' | 'checkout'>('bag');
  const [failedImages, setFailedImages] = useState<number[]>([]);
  const step = 'min-w-10 min-h-10 rounded bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40';
  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden="true" />
      <motion.aside ref={ref} role="dialog" aria-modal="true" aria-label={view === 'bag' ? 'Shopping bag' : 'Checkout'} tabIndex={-1}
        className="absolute inset-y-0 right-0 w-full sm:w-screen max-w-md min-h-0 bg-cream dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xl flex flex-col border-l border-neutral-300 dark:border-neutral-800"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <div className="shrink-0 flex items-center justify-between gap-3 p-4 sm:p-6 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="min-w-0 text-lg sm:text-xl font-black uppercase tracking-tight flex items-center gap-2">
            <span>{view === 'bag' ? 'Your Bag' : 'Checkout'}</span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={count} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
                className="shrink-0 bg-brandRed text-white text-xs px-2 py-0.5 rounded-full">{count}</motion.span>
            </AnimatePresence>
          </h2>
          <button onClick={onClose} aria-label="Close bag" className="shrink-0 min-w-11 min-h-11 inline-flex items-center justify-center text-neutral-500 hover:text-brandRed transition-colors rounded-full"><X size={22} /></button>
        </div>

        {view === 'checkout' ? (
          <CheckoutForm lines={lines} subtotal={subtotal} onBack={() => setView('bag')} onAccepted={onOrderAccepted} onClose={onClose} />
        ) : lines.length === 0 ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center p-6 text-neutral-400">
            <ShoppingBag size={48} className="mb-4 opacity-40" aria-hidden="true" />
            <p className="text-sm font-medium">Your bag is currently empty.</p>
            <button onClick={onClose} className="mt-6 min-h-11 px-2 text-xs font-mono uppercase tracking-wider text-brandRed underline underline-offset-4">Continue shopping</button>
          </div>
        ) : (
          <>
            <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5 sm:space-y-6">
              <AnimatePresence initial={false} mode="popLayout">
                {lines.map(({ product: p, qty }) => (
                  <motion.li layout key={p.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
                    className="flex items-center gap-3 sm:gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
                    {failedImages.includes(p.id) ? (
                      <div className="w-16 h-20 shrink-0 bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center p-1 text-center text-[9px] font-mono uppercase text-neutral-500">{p.name}</div>
                    ) : (
                      <img src={p.image} alt={`${p.name} product preview`} width={64} height={80} onError={() => setFailedImages(prev => prev.includes(p.id) ? prev : [...prev, p.id])}
                        className="w-16 h-20 shrink-0 object-cover bg-neutral-200 dark:bg-neutral-800" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm mb-1 [overflow-wrap:anywhere]">{p.name}</h4>
                      <p className="text-xs text-brandRed font-bold mb-2">{money(p.price)}</p>
                      <div className="flex items-center gap-2">
                        <button className={step} disabled={qty <= 1} onClick={() => onQty(p.id, qty - 1)} aria-label={`Decrease quantity of ${p.name}`}><Minus size={12} /></button>
                        <span className="min-w-5 text-center text-xs font-bold tabular-nums" aria-live="polite">{qty}</span>
                        <button className={step} disabled={qty >= MAX_CART_QTY} onClick={() => onQty(p.id, qty + 1)} aria-label={`Increase quantity of ${p.name}`}><Plus size={12} /></button>
                      </div>
                    </div>
                    <button onClick={() => onQty(p.id, 0)} aria-label={`Remove ${p.name} from bag`} className="shrink-0 min-w-10 min-h-10 inline-flex items-center justify-center text-neutral-400 hover:text-brandRed transition-colors rounded-full"><Trash2 size={16} /></button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            <div className="shrink-0 p-4 sm:p-6 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-950">
              <div className="flex justify-between items-center gap-4 mb-4 text-base font-bold">
                <span>Subtotal</span>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span key={subtotal} className="shrink-0 tabular-nums" initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }}>{money(subtotal)}</motion.span>
                </AnimatePresence>
              </div>
              <p className="text-xs text-neutral-500 mb-4">Cash on Delivery available all over Pakistan.</p>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setView('checkout')}
                className="w-full min-h-12 bg-brandRed hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-colors shadow-lg uppercase tracking-wider text-xs">
                Proceed to Checkout
              </motion.button>
            </div>
          </>
        )}
      </motion.aside>
    </div>
  );
}
