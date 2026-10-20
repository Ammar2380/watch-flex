import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { ease, useCalm } from '../motion';

export default function Hero({ ready }: { ready: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const calm = useCalm();
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  // Keep the editorial drift, but cap the wordmark and disable large movement on small/reduced-motion screens.
  const y = useTransform(p, [0, 1], [0, calm ? 0 : 140]);
  const scale = useTransform(p, [0, 1], [1, calm ? 1 : 1.08]);
  const rx = useTransform(p, [0, 1], [0, calm ? 0 : -80]);
  const slide = (delay: number) => ({ initial: { y: '110%', scale: 1.12 }, animate: ready ? { y: 0, scale: 1 } : {}, transition: { duration: 1.1, ease, delay } });
  const fade = (delay: number) => ({ initial: { opacity: 0, y: 16 }, animate: { opacity: ready ? 1 : 0, y: ready ? 0 : 16 }, transition: { duration: 0.7, ease, delay } });
  return (
    <section id="top" ref={ref} className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-8">
      <div className="relative overflow-hidden">
        <motion.h1 aria-label="WATCHFLEX" style={{ y, scale, transformOrigin: '0% 50%' }}
          className="flex min-w-0 flex-nowrap items-start justify-between gap-1 text-[clamp(2.15rem,11.5vw,9rem)] sm:text-[clamp(4.5rem,10vw,9rem)] leading-none font-black tracking-[-0.075em] text-brandRed select-none uppercase">
          <span aria-hidden className="flex min-w-0 flex-1 overflow-hidden whitespace-nowrap pb-[0.04em]">
            <motion.span {...slide(0)} className="inline-block">WATCH</motion.span>
            <motion.span {...slide(0.14)} className="inline-block">FLEX</motion.span>
          </span>
          <motion.span style={{ x: rx }} aria-hidden className="shrink-0 ml-1 text-[clamp(1.1rem,3.2vw,3.8rem)] font-light tracking-normal self-start mt-1 sm:mt-4">®</motion.span>
        </motion.h1>
      </div>
      <motion.div {...fade(0.5)} className="grid grid-cols-2 sm:grid-cols-5 gap-x-3 gap-y-2 pt-6 pb-4 border-t border-neutral-300 dark:border-neutral-800 text-[10px] sm:text-xs font-mono uppercase tracking-wider text-brandRed">
        <div>WATCHFLEX</div><div>WHY</div><div className="hidden sm:block" />
        <div className="sm:text-right">VISIT ++ WEBSITE</div><div className="text-right">2026</div>
      </motion.div>
      <motion.div {...fade(0.65)} className="py-6 max-w-2xl">
        <p className="text-base sm:text-lg font-medium leading-relaxed text-brandRed">
          Created by the ++watchflex team, this store and signature collection celebrate our collective precision and passion for luxury timepieces. Carefully crafted.
        </p>
      </motion.div>
    </section>
  );
}
