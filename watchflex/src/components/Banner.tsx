import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { ease, useCalm } from '../motion';

export default function Banner() {
  const ref = useRef<HTMLElement>(null);
  const calm = useCalm();
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const x = useTransform(p, [0, 0.6], [calm ? 0 : 240, 0]);
  const rot = useTransform(p, [0, 0.6], [calm ? 0 : 8, 0]);
  const words = 'Made to be worn. Or timed. Or both.'.split(' ');
  return (
    <section ref={ref} className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20 border-t border-neutral-300 dark:border-neutral-800 mt-12 sm:mt-20 overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <h2 aria-label="Made to be worn. Or timed. Or both." className="text-[clamp(2rem,5.5vw,4.5rem)] font-black text-brandRed tracking-tight uppercase max-w-3xl leading-[0.95]">
          {words.map((w, i) => (
            <span key={i} aria-hidden className="inline-block overflow-hidden align-bottom mr-[0.25em]">
              <motion.span className="inline-block" initial={{ y: '110%' }} whileInView={{ y: 0 }} viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.9, ease, delay: i * 0.07 }}>{w}</motion.span>
            </span>
          ))}
        </h2>
        <motion.div style={{ x, rotate: rot }} aria-hidden className="text-[clamp(4rem,8vw,8rem)] leading-none font-black text-brandRed tracking-tighter select-none">©26</motion.div>
      </div>
    </section>
  );
}
