import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

/** Escape to close, Tab focus trap, body scroll lock, and focus restore for modal surfaces. */
export function useDialog<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    el?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return close.current();
      if (e.key !== 'Tab' || !el) return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);
  return ref;
}
