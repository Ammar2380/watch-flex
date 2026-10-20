import { useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import type { Product } from '../types';
import { useCalm } from '../motion';

/** Editorial strip built from the first six real products. It travels sideways as the page scrolls past; vertical scrolling is never captured. */
export default function Strip({ products, onQuick }: { products: Product[]; onQuick: (p: Product) => void }) {
  const ref = useRef<HTMLElement>(null);
  const calm = useCalm();
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const x = useTransform(p, [0, 1], calm ? ['0%', '0%'] : ['6%', '-38%']);
  const wx = useTransform(p, [0, 1], calm ? ['0%', '0%'] : ['-30%', '12%']);
  const items = products.slice(0, 6);
  const [failedImages, setFailedImages] = useState<number[]>([]);
  return (
    <section ref={ref} aria-label="Collection preview" className="relative overflow-hidden py-16 border-t border-neutral-300 dark:border-neutral-800">
      <motion.p aria-hidden style={{ x: wx }} className="absolute top-6 left-0 text-[18vw] leading-none font-black tracking-tighter uppercase text-brandRed/10 whitespace-nowrap select-none pointer-events-none">The Collection</motion.p>
      <motion.ul style={{ x }} className="relative flex gap-4 sm:gap-6 w-max max-w-full md:max-w-none px-4 sm:px-6 pt-[8vw] overflow-x-auto md:overflow-visible overscroll-x-contain snap-x snap-proximity">
        {items.map((s, i) => (
          <motion.li key={s.id} className={`w-[62vw] sm:w-[34vw] lg:w-[22vw] shrink-0 snap-start ${i % 2 ? 'mt-10' : ''}`}
            initial={{ clipPath: 'inset(0 0 100% 0)' }} whileInView={{ clipPath: 'inset(0 0 0% 0)' }} viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: i * 0.06 }}>
            <button onClick={() => onQuick(s)} aria-label={`Quick view ${s.name}`} className="group block w-full text-left">
              <span className="relative block overflow-hidden aspect-[3/4] bg-neutral-200 dark:bg-neutral-800">
                {failedImages.includes(s.id) ? (
                  <span className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs font-mono uppercase text-neutral-500">{s.name}</span>
                ) : (
                  <img src={s.image} alt={`${s.name} product preview`} width={800} height={1000} loading="lazy" decoding="async"
                    onError={() => setFailedImages(prev => prev.includes(s.id) ? prev : [...prev, s.id])}
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" />
                )}
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
