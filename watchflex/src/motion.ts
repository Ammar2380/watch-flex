import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';

/** One easing for the whole site: fast start, long settle. */
export const ease = [0.16, 1, 0.3, 1] as const;
export const wipe = { hidden: 'inset(100% 0% 0% 0%)', shown: 'inset(0% 0% 0% 0%)', up: 'inset(0% 0% 100% 0%)' };

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
