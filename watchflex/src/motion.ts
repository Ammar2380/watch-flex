import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';

/** One easing for the whole site: fast start, long settle. */
export const ease = [0.16, 1, 0.3, 1] as const;
/** Duration tiers (s) and stagger step. Every reveal on the site uses these. */
export const T = { fast: 0.45, base: 0.9, slow: 1.3, step: 0.08 } as const;
export const wipe = { hidden: 'inset(100% 0% 0% 0%)', shown: 'inset(0% 0% 0% 0%)', up: 'inset(0% 0% 100% 0%)' };

/** Grid columns currently shown (1 / 2 / 4), so row/column stagger matches the real layout. */
export function useCols() {
  const get = () => (window.matchMedia('(min-width: 1024px)').matches ? 4 : window.matchMedia('(min-width: 640px)').matches ? 2 : 1);
  const [c, setC] = useState(get);
  useEffect(() => { const f = () => setC(get()); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  return c;
}

/** True on phones or when the visitor prefers reduced motion: scroll-linked parallax is flattened. */
export function useCalm() {
  const rm = useReducedMotion();
  const q = '(max-width: 767px)';
  const [small, setSmall] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q); const f = () => setSmall(m.matches);
    m.addEventListener('change', f); return () => m.removeEventListener('change', f);
  }, []);
  return !!rm || small;
}
