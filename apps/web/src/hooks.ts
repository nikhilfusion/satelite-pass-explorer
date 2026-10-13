import { useEffect, useRef, useState } from 'react';

/** Debounces a value; structurally equal values (by JSON) do not restart the timer. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  const key = JSON.stringify(value);
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    const id = setTimeout(() => setDebounced(latest.current), delayMs);
    return () => clearTimeout(id);
  }, [key, delayMs]);

  return debounced;
}
