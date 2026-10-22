import { motion } from 'motion/react';
import { T, ease } from '../motion';

/** Opens the page: WATCH / FLEX rise through a mask, then the supporting rows follow on the same beat. */
export default function Hero({ ready }: { ready: boolean }) {
  const rise = (d: number) => ({ initial: { y: '110%' }, animate: ready ? { y: 0 } : {}, transition: { duration: T.slow, ease, delay: d } });
  const row = (d: number) => ({ initial: { clipPath: 'inset(0 0 100% 0)' }, animate: ready ? { clipPath: 'inset(0 0 0% 0)' } : {}, transition: { duration: T.base, ease, delay: d } });
  return (
    <section className="max-w-7xl mx-auto px-6 pt-12 pb-8">
      <h1 aria-label="WATCHFLEX" className="text-[12vw] sm:text-[min(14vw,11.5rem)] leading-none font-black tracking-tighter text-brandRed select-none uppercase flex items-center justify-between">
        <span aria-hidden className="flex overflow-hidden pb-[0.04em]">
          <motion.span {...rise(0)} className="inline-block">WATCH</motion.span>
          <motion.span {...rise(T.step)} className="inline-block">FLEX</motion.span>
        </span>
        <span aria-hidden className="text-4xl sm:text-7xl font-light self-start mt-2 sm:mt-6">®</span>
      </h1>
      <motion.div {...row(0.4)} className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-6 pb-4 border-t border-neutral-300 dark:border-neutral-800 text-xs font-mono uppercase tracking-wider text-brandRed">
        <div>WATCHFLEX</div><div>WHY</div><div className="hidden sm:block" />
        <div className="sm:text-right">VISIT ++ WEBSITE</div><div className="text-right">2026</div>
      </motion.div>
      <motion.div {...row(0.5)} className="py-6 max-w-2xl">
        <p className="text-base sm:text-lg font-medium leading-relaxed text-brandRed">
          Created by the ++watchflex team, this store and signature collection celebrate our collective precision and passion for luxury timepieces. Carefully crafted.
        </p>
      </motion.div>
    </section>
  );
}
