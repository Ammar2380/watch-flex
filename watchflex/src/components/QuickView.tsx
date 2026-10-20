import { useState } from 'react';
import { motion } from 'motion/react';
import { Minus, Plus, X } from 'lucide-react';
import type { Product } from '../types';
import { MAX_CART_QTY, money } from '../config';
import { useDialog } from '../hooks/useDialog';
import WishButton from './WishButton';

interface Props { product: Product; wished: boolean; onClose: () => void; onAdd: (qty: number) => void; onWish: () => void }

export default function QuickView({ product: p, wished, onClose, onAdd, onWish }: Props) {
  const ref = useDialog<HTMLDivElement>(onClose);
  const [qty, setQty] = useState(1);
  const [imageFailed, setImageFailed] = useState(false);
  const step = 'min-w-10 min-h-10 rounded bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center disabled:opacity-40';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <motion.div className="absolute inset-0 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden="true" />
      <motion.div ref={ref} role="dialog" aria-modal="true" aria-labelledby="qv-title"
        className="relative bg-cream dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 w-full max-w-3xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-xl sm:rounded-2xl shadow-2xl border border-neutral-300 dark:border-neutral-800 flex flex-col md:flex-row md:h-[min(82dvh,42rem)] md:overflow-hidden"
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.94, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}>
        <div className="sticky top-0 z-20 h-0 shrink-0">
          <button onClick={onClose} aria-label="Close quick view" className="absolute top-2 right-2 min-w-11 min-h-11 inline-flex items-center justify-center bg-cream dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:text-brandRed rounded-full border border-neutral-300 dark:border-neutral-700 shadow-sm">
            <X size={22} />
          </button>
        </div>
        <div className="md:w-1/2 md:h-full md:min-h-0 shrink-0 bg-neutral-200 dark:bg-neutral-800">
          {imageFailed ? (
            <div className="h-48 sm:h-64 md:h-full w-full flex items-center justify-center p-6 text-center text-xs font-mono uppercase text-neutral-500">{p.name}</div>
          ) : (
            <img src={p.image} alt={`${p.name} — ${p.tag.toLowerCase()} (placeholder photo)`} width={800} height={1000} onError={() => setImageFailed(true)}
              className="w-full h-48 sm:h-64 md:h-full object-cover" />
          )}
        </div>
        <div className="md:w-1/2 p-4 sm:p-6 md:p-8 flex flex-col justify-between gap-6 md:min-h-0 md:overflow-y-auto overscroll-contain">
          <div className="pt-1 pr-9">
            <span className="text-xs font-mono uppercase tracking-widest text-brandRed">{p.tag}</span>
            <h2 id="qv-title" className="text-2xl sm:text-3xl font-black uppercase tracking-tight mt-4 mb-2 [overflow-wrap:anywhere]">{p.name}</h2>
            <p className="text-sm text-neutral-500 mb-4 font-mono [overflow-wrap:anywhere]">{p.subtitle}</p>
            <p className="text-xl font-bold text-brandRed mb-6">{money(p.price)}</p>
            {p.description && <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">{p.description}</p>}
          </div>
          <div className="space-y-4 md:pt-5">
            <div className="flex items-center justify-between gap-4 text-xs font-mono uppercase tracking-wider">
              <div className="flex items-center gap-3" role="group" aria-label="Quantity">
                <button className={step} disabled={qty <= 1} onClick={() => setQty(q => q - 1)} aria-label="Decrease quantity"><Minus size={14} /></button>
                <span className="min-w-6 text-center font-bold tabular-nums" aria-live="polite">{qty}</span>
                <button className={step} disabled={qty >= MAX_CART_QTY} onClick={() => setQty(q => q + 1)} aria-label="Increase quantity"><Plus size={14} /></button>
              </div>
              <WishButton name={p.name} wished={wished} onToggle={onWish} size={20} />
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => onAdd(qty)}
              className="w-full min-h-12 bg-brandRed hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-colors shadow-lg uppercase tracking-wider text-xs">
              Add to Bag
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
