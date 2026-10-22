import { useState } from 'react';
import { motion } from 'motion/react';
import { Minus, Plus, X } from 'lucide-react';
import type { Product } from '../types';
import { money } from '../config';
import { useDialog } from '../hooks/useDialog';
import WishButton from './WishButton';

interface Props { product: Product; wished: boolean; onClose: () => void; onAdd: (qty: number) => void; onWish: () => void }

export default function QuickView({ product: p, wished, onClose, onAdd, onWish }: Props) {
  const ref = useDialog<HTMLDivElement>(onClose);
  const [qty, setQty] = useState(1);
  const step = 'w-10 h-10 sm:w-8 sm:h-8 rounded bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center disabled:opacity-40';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div className="absolute inset-0 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div ref={ref} role="dialog" aria-modal="true" aria-labelledby="qv-title"
        className="relative bg-cream dark:bg-neutral-900 w-full max-w-3xl max-h-[92dvh] overflow-y-auto rounded-2xl shadow-2xl border border-neutral-300 dark:border-neutral-800 flex flex-col md:flex-row"
        initial={{ opacity: 0, scale: 0.94, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}>
        <div className="md:w-1/2 bg-neutral-200 dark:bg-neutral-800 shrink-0">
          <img src={p.image} alt={`${p.name} — ${p.tag.toLowerCase()} (placeholder photo)`} width={800} height={1000} className="w-full h-64 md:h-full object-cover" />
        </div>
        <div className="md:w-1/2 p-8 flex flex-col justify-between gap-6">
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-mono uppercase tracking-widest text-brandRed">{p.tag}</span>
              <button onClick={onClose} aria-label="Close quick view" className="p-2 -m-2 text-neutral-400 hover:text-brandRed"><X size={22} /></button>
            </div>
            <h2 id="qv-title" className="text-2xl font-black uppercase tracking-tight mb-2">{p.name}</h2>
            <p className="text-sm text-neutral-500 mb-4 font-mono">{p.subtitle}</p>
            <p className="text-xl font-bold text-brandRed mb-6">{money(p.price)}</p>
            {p.description && <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">{p.description}</p>}
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider">
              <div className="flex items-center gap-3" role="group" aria-label="Quantity">
                <button className={step} disabled={qty <= 1} onClick={() => setQty(q => q - 1)} aria-label="Decrease quantity"><Minus size={14} /></button>
                <span className="w-6 text-center font-bold tabular-nums" aria-live="polite">{qty}</span>
                <button className={step} disabled={qty >= 99} onClick={() => setQty(q => q + 1)} aria-label="Increase quantity"><Plus size={14} /></button>
              </div>
              <WishButton name={p.name} wished={wished} onToggle={onWish} size={20} />
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => onAdd(qty)}
              className="w-full bg-brandRed hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-colors shadow-lg uppercase tracking-wider text-xs">
              Add to Bag
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
