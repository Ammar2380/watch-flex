import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import type { CartLine } from '../types';
import { money } from '../config';
import { useDialog } from '../hooks/useDialog';
import CheckoutForm from './CheckoutForm';

interface Props {
  lines: CartLine[]; count: number; subtotal: number;
  onQty: (id: number, qty: number) => void; onClose: () => void; onOrderAccepted: () => void;
}

export default function BagDrawer({ lines, count, subtotal, onQty, onClose, onOrderAccepted }: Props) {
  const ref = useDialog<HTMLElement>(onClose);
  const [view, setView] = useState<'bag' | 'checkout'>('bag');
  const step = 'w-9 h-9 sm:w-7 sm:h-7 rounded bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center active:scale-90 transition-transform';
  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside ref={ref} role="dialog" aria-modal="true" aria-label="Shopping bag"
        className="absolute inset-y-0 right-0 w-screen max-w-md bg-cream dark:bg-neutral-900 shadow-2xl flex flex-col border-l border-neutral-300 dark:border-neutral-800"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-xl font-black uppercase tracking-tight relative flex items-center space-x-2">
            <span>{view === 'bag' ? 'Your Bag' : 'Checkout'}</span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={count} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
                className="bg-brandRed text-white text-xs px-2 py-0.5 rounded-full">{count}</motion.span>
            </AnimatePresence>
          </h2>
          <button onClick={onClose} aria-label="Close bag" className="p-2 text-neutral-500 hover:text-brandRed transition-colors"><X size={22} /></button>
        </div>

        {view === 'checkout' ? (
          <CheckoutForm lines={lines} subtotal={subtotal} onBack={() => setView('bag')} onAccepted={onOrderAccepted} onClose={onClose} />
        ) : lines.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-neutral-400">
            <ShoppingBag size={48} className="mb-4 opacity-40" aria-hidden />
            <p className="text-sm font-medium">Your bag is currently empty.</p>
            <button onClick={onClose} className="mt-6 text-xs font-mono uppercase tracking-wider text-brandRed underline underline-offset-4">Continue shopping</button>
          </div>
        ) : (
          <>
            <ul className="relative flex-1 overflow-y-auto p-6 space-y-6">
              <AnimatePresence initial={false} mode="popLayout">
                {lines.map(({ product: p, qty }) => (
                  <motion.li layout key={p.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
                    className="flex items-center space-x-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
                    <img src={p.image} alt={p.name} width={64} height={80} className="w-16 h-20 object-cover rounded" />
                    <div className="flex-1">
                      <h4 className="font-bold text-sm mb-1">{p.name}</h4>
                      <p className="text-xs text-brandRed font-bold mb-2">{money(p.price)}</p>
                      <div className="flex items-center space-x-3">
                        <button className={step} onClick={() => onQty(p.id, qty - 1)} aria-label={`Decrease quantity of ${p.name}`}><Minus size={12} /></button>
                        <span className="text-xs font-bold tabular-nums" aria-live="polite">{qty}</span>
                        <button className={step} onClick={() => onQty(p.id, qty + 1)} aria-label={`Increase quantity of ${p.name}`}><Plus size={12} /></button>
                      </div>
                    </div>
                    <button onClick={() => onQty(p.id, 0)} aria-label={`Remove ${p.name} from bag`} className="text-neutral-400 hover:text-brandRed transition-colors p-3"><Trash2 size={16} /></button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-950">
              <div className="relative flex justify-between items-center mb-4 text-base font-bold">
                <span>Subtotal</span>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span key={subtotal} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }}>{money(subtotal)}</motion.span>
                </AnimatePresence>
              </div>
              <p className="text-xs text-neutral-500 mb-4">Cash on Delivery available all over Pakistan.</p>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setView('checkout')}
                className="w-full bg-brandRed hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-colors shadow-lg uppercase tracking-wider text-xs">
                Proceed to Checkout
              </motion.button>
            </div>
          </>
        )}
      </motion.aside>
    </div>
  );
}
