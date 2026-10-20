import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ease } from '../motion';
import { useDialog } from '../hooks/useDialog';

const src = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=600&q=80`;
const steps = [
  { num: '001', img: src('1523275335684-37898b6baf30') },
  { num: '022', img: src('1524805444758-089113d48a6d') },
  { num: '093', img: src('1533139502658-0198f920d8e8') },
];

/** Layered watch-card intro (~3s). Shown once per session; skippable by button, click or Escape; a hard failsafe always releases the page. */
export default function IntroSequence({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const dialogRef = useDialog<HTMLDivElement>(onDone);
  useEffect(() => {
    const t = setTimeout(() => (i >= steps.length - 1 ? onDone() : setI(i + 1)), i === steps.length - 1 ? 1100 : 850);
    return () => clearTimeout(t);
  }, [i, onDone]);
  useEffect(() => {
    const fail = setTimeout(onDone, 6000);
    return () => clearTimeout(fail);
  }, [onDone]);

  return (
    <motion.div ref={dialogRef} role="dialog" aria-modal="true" aria-label="WATCHFLEX intro" tabIndex={-1} className="fixed inset-0 z-50 bg-black text-white overflow-hidden cursor-pointer"
      initial={{ clipPath: 'inset(0% 0% 0% 0%)' }} exit={{ clipPath: 'inset(0% 0% 100% 0%)' }} transition={{ duration: 0.9, ease }} onClick={onDone}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[64vw] max-w-72 aspect-[9/10]">
          <motion.div className="absolute inset-0 bg-brandRed" animate={{ rotate: 3 + i * 3, scale: 1 + i * 0.03 }} transition={{ duration: 0.8, ease }} />
          {steps.slice(0, i + 1).map((s, k) => {
            const depth = i - k;
            return (
              <motion.div key={s.num} className="absolute inset-0 bg-white overflow-hidden p-3 shadow-2xl" style={{ zIndex: k + 1 }}
                initial={{ clipPath: 'inset(100% 0% 0% 0%)', rotate: -10, y: 50 }}
                animate={{ clipPath: 'inset(0% 0% 0% 0%)', rotate: (k % 2 ? 3 : -3) - depth * 1.5, y: -depth * 22, scale: 1 - depth * 0.06 }}
                transition={{ duration: 0.9, ease }}>
                <img src={s.img} alt="" className="w-full h-full object-cover bg-neutral-300" />
              </motion.div>
            );
          })}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 overflow-hidden px-4 pointer-events-none">
        <motion.p aria-hidden className="text-[17vw] leading-[0.82] font-black tracking-tighter text-brandRed uppercase whitespace-nowrap"
          initial={{ y: '100%' }} animate={{ y: '8%' }} transition={{ duration: 1.2, ease, delay: 0.15 }}>WATCHFLEX</motion.p>
      </div>
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between text-xs font-mono uppercase tracking-widest text-neutral-400">
        <span aria-hidden>{steps[i].num}</span>
        <button onClick={e => { e.stopPropagation(); onDone(); }} className="min-h-11 border border-neutral-600 px-4 py-2 hover:border-brandRed hover:text-brandRed transition-colors">Skip intro</button>
      </div>
    </motion.div>
  );
}
