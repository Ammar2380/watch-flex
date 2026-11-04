'use client';
import { useEffect, useLayoutEffect, useRef } from 'react';

const useIso = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Fits a headline to its container width; the ® badge scales with the text (.2em reserved). */
export function fit(h) {
  const el = h && h.querySelector('.fit');
  if (!el) return;
  const r = h.querySelector('sup') ? 0.2 : 0;
  h.style.fontSize = '100px';
  const w = el.getBoundingClientRect().width;
  const a = h.clientWidth;
  if (w && a) h.style.fontSize = a / (w / 100 + r) + 'px';
}

/** Big wordmark heading. `reg` shows the ® badge. */
export default function Wm({ text, reg = false }) {
  const ref = useRef(null);
  useIso(() => {
    const h = ref.current;
    fit(h);
    let lw = window.innerWidth, raf = 0;
    const onResize = () => {
      if (window.innerWidth === lw) return;
      lw = window.innerWidth;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => fit(h));
    };
    window.addEventListener('resize', onResize);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fit(h)); // re-fit once the web font arrives
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf); };
  }, [text]);
  return (
    <h1 className="wm" ref={ref}>
      <span className="fit"><span className="ch">{text}</span></span>
      {reg ? <sup aria-hidden="true">R</sup> : null}
    </h1>
  );
}
