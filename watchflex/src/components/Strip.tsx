import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import type { Product } from '../types';
import { T, ease, useCalm } from '../motion';

/** Editorial strip built from the first six real products. It travels sideways as the page scrolls past; vertical scrolling is never captured. */
export default function Strip({ products, onQuick }: { products: Product[]; onQuick: (p: Product) => void }) {
  const ref = useRef<HTMLElement>(null);
  const calm = useCalm();
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const list = useRef<HTMLUListElement>(null);
  const [dist, setDist] = useState(0);
  useEffect(() => {
    const m = () => { const el = list.current; if (el) setDist(Math.max(0, el.scrollWidth - document.documentElement.clientWidth)); };
    m(); const ro = new ResizeObserver(m); if (list.current) ro.observe(list.current);
    window.addEventListener('resize', m); return () => { ro.disconnect(); window.removeEventListener('resize', m); };
  }, []);
  const x = useTransform(p, [0.05, 0.95], [0, calm ? 0 : -dist]);
  const items = products.slice(0, 6);
  return (
    <section ref={ref} aria-label="Collection preview" className="relative overflow-x-clip py-16 border-t border-neutral-300 dark:border-neutral-800">
      <motion.ul ref={list} style={{ x }} className="relative flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x gap-4 sm:gap-6 w-max px-6 pt-[8vw] overflow-x-auto md:overflow-visible max-w-full md:max-w-none">
        {items.map((s, i) => (
          <motion.li key={s.id} className={`w-[62vw] sm:w-[34vw] lg:w-[22vw] shrink-0 snap-start ${i % 2 ? 'mt-10' : ''}`}
            initial={{ clipPath: 'inset(0 0 100% 0)' }} whileInView={{ clipPath: 'inset(0 0 0% 0)' }} viewport={{ once: true, margin: '0px' }}
            transition={{ duration: T.slow, ease, delay: i * T.step }}>
            <button onClick={() => onQuick(s)} aria-label={`Quick view ${s.name}`} className="group block w-full text-left">
              <span className="block overflow-hidden aspect-[3/4] bg-neutral-200 dark:bg-neutral-800">
                <img src={s.image} alt="" width={800} height={1000} loading="lazy" decoding="async"
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" />
              </span>
              <span className="mt-3 flex justify-between font-mono text-[11px] uppercase tracking-wider">
                <span>{String(i + 1).padStart(3, '0')} — {s.name}</span>
                <span className="text-brandRed transition-transform duration-300 group-hover:translate-x-1">→</span>
              </span>
            </button>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}
