import { motion } from 'motion/react';
import { T, ease } from '../motion';

export default function Banner() {
  const words = 'Made to be worn. Or timed. Or both.'.split(' ');
  return (
    <section className="max-w-7xl mx-auto px-6 py-20 border-t border-neutral-300 dark:border-neutral-800 mt-20 overflow-x-clip">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <h2 aria-label="Made to be worn. Or timed. Or both." className="text-4xl sm:text-7xl font-black text-brandRed tracking-tight uppercase max-w-3xl leading-none">
          {words.map((w, i) => (
            <span key={i} aria-hidden className="inline-block overflow-hidden align-bottom mr-[0.25em]">
              <motion.span className="inline-block" initial={{ y: '110%' }} whileInView={{ y: 0 }} viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: T.base, ease, delay: i * T.step }}>{w}</motion.span>
            </span>
          ))}
        </h2>
        <motion.div aria-hidden className="text-8xl sm:text-9xl font-black text-brandRed tracking-tighter select-none"
          initial={{ clipPath: 'inset(0 0 100% 0)' }} whileInView={{ clipPath: 'inset(0 0 0% 0)' }} viewport={{ once: true }} transition={{ duration: T.slow, ease, delay: 0.5 }}>©26</motion.div>
      </div>
    </section>
  );
}
