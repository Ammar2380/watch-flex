import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { links } from '../config';
import { useCalm } from '../motion';

// Labels without a destination in config.links render as plain text, never as dead links.
const L = (t: string, cls = '') => links[t]
  ? <a href={links[t]} className={`hover:text-brandRed transition-colors ${cls}`}>{t}</a>
  : <span className={cls}>{t}</span>;

function FooterInfo() {
  const li = (t: string, cls?: string) => <li key={t}>{L(t, cls)}</li>;
  return (
    <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12 border-t border-neutral-300 dark:border-neutral-800 text-xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 mb-10 sm:mb-12">
        <div>
          <h3 className="font-black text-brandRed text-sm mb-3">++watchflex</h3>
          <p className="text-neutral-500 mb-2">All rights reserved © 2026</p>
        </div>
        <div className="text-neutral-500 leading-relaxed space-y-2">
          <p>Cash on Delivery</p><p>All Over Pakistan</p><p>Delivery: 3-5 Days</p>
        </div>
        <ul className="space-y-2 text-neutral-600 dark:text-neutral-400">{['Privacy Policy', 'Shipping & Returns'].map(t => li(t))}</ul>
        <div className="grid grid-cols-2 gap-4 text-neutral-600 dark:text-neutral-400">
          <ul className="space-y-2">{['Dribbble', 'Instagram', 'LinkedIn', 'Twitter (X)'].map(t => li(t))}</ul>
          <ul className="space-y-2">{['Work', 'Services', 'About', 'Careers'].map(t => li(t))}{li("Let's talk", 'font-bold text-brandRed')}</ul>
        </div>
      </div>
    </footer>
  );
}

export function Footer() {
  const ref = useRef<HTMLDivElement>(null);
  const calm = useCalm();
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start end', 'end end'] });
  const y = useTransform(p, [0, 1], [calm ? '0%' : '55%', '6%']);
  return (
    <div ref={ref} className="overflow-hidden">
      <FooterInfo />
      <div aria-hidden className="max-w-7xl mx-auto px-4 sm:px-6 h-[clamp(4rem,13vw,12rem)] overflow-hidden select-none">
        <motion.p style={{ y }} className="text-[clamp(3rem,13vw,12rem)] leading-[0.8] font-black tracking-tighter text-brandRed uppercase whitespace-nowrap">WATCHFLEX</motion.p>
      </div>
    </div>
  );
}
