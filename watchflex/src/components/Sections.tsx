import { AnimatePresence, motion } from 'motion/react';
import { Moon, Sun } from 'lucide-react';


export function Header({ count, dark, onBag, onTheme }: { count: number; dark: boolean; onBag: () => void; onTheme: () => void }) {
  return (
    <header className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between gap-4 border-b border-neutral-300 dark:border-neutral-800">
      <a href="#top" aria-label="WATCHFLEX home" className="text-brandRed font-black text-2xl tracking-tighter leading-none shrink-0">++</a>
      <nav aria-label="Primary" className="flex items-center gap-2 sm:gap-6 font-medium text-sm shrink-0">
        <a href="#shop-grid" className="min-h-11 inline-flex items-center px-2 hover:text-brandRed transition-colors">Shop</a>
        <button onClick={onBag} aria-label={`Open bag, ${count} ${count === 1 ? 'item' : 'items'}`}
          className="min-h-11 inline-flex items-center justify-center gap-1 px-2 hover:text-brandRed transition-colors active:scale-95">
          <span>Bag</span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={count} className="text-brandRed font-bold inline-block tabular-nums"
              initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}>({count})</motion.span>
          </AnimatePresence>
        </button>
        <button onClick={onTheme} role="switch" aria-checked={dark} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="relative min-w-12 min-h-11 inline-flex items-center justify-center rounded-full p-1 hover:opacity-80 transition-opacity">
          <span aria-hidden className="relative w-12 h-6 flex items-center bg-neutral-300 dark:bg-neutral-700 rounded-full p-1 transition-colors">
            <motion.span className="bg-white w-4 h-4 rounded-full shadow-md flex items-center justify-center text-black"
              animate={{ x: dark ? 24 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
              {dark ? <Moon size={9} /> : <Sun size={9} />}
            </motion.span>
          </span>
        </button>
      </nav>
    </header>
  );
}
