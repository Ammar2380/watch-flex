import { useEffect, useState } from 'react';

/** useState persisted to localStorage. Malformed or invalid stored data falls back to `initial`. */
export function useLocalStorage<T>(key: string, initial: T, isValid: (v: unknown) => boolean = () => true) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (isValid(parsed)) return parsed as T;
      }
    } catch { /* corrupt or unavailable storage */ }
    return initial;
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
  }, [key, value]);
  return [value, setValue] as const;
}
