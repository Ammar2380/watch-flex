import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react';
import { Moon, Sun } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

export function Header({ count, dark, onBag, onTheme }: { count: number; dark: boolean; onBag: () => void; onTheme: () => void }) {
  const { scrollYProgress } = useScroll();
  const hand = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 });
  return (
    <div className="sticky top-0 z-40 bg-cream dark:bg-darkBg transition-colors duration-[400ms]">
    <header className="max-w-7xl mx-auto px-6 py-3 sm:py-5 flex items-center justify-between border-b border-neutral-300 dark:border-neutral-800">
      <span className="text-brandRed font-black text-2xl tracking-tighter">++</span>
      <nav aria-label="Primary" className="flex items-center space-x-8 font-medium text-sm">
        <a href="#shop-grid" className="py-2 hover:text-brandRed transition-colors">Shop</a>
        <button onClick={onBag} aria-label={`Open bag, ${count} ${count === 1 ? 'item' : 'items'}`}
          className="hover:text-brandRed transition-colors relative py-2 flex items-center space-x-1 active:scale-95">
          <span>Bag</span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={count} className="text-brandRed font-bold inline-block"
              initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}>({count})</motion.span>
          </AnimatePresence>
        </button>
        <button onClick={onTheme} role="switch" aria-checked={dark} aria-label="Dark mode"
          className="relative w-12 h-6 flex items-center bg-neutral-300 dark:bg-neutral-700 rounded-full p-1 transition-colors">
          <motion.span className="bg-white w-4 h-4 rounded-full shadow-md flex items-center justify-center text-black"
            animate={{ x: dark ? 24 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
            {dark ? <Moon size={9} /> : <Sun size={9} />}
          </motion.span>
        </button>
      </nav>
    </header>
    <motion.div aria-hidden style={{ scaleX: hand }} className="h-0.5 bg-brandRed origin-left" />
    </div>
  );
}
