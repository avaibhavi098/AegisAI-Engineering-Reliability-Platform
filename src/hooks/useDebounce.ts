import { useState, useEffect } from 'react';

/**
 * useDebounce hook delays updating the debounced value until after the
 * specified delay has elapsed since the last time the value changed.
 * This avoids expensive re-computations or network requests while typing.
 */
export function useDebounce<T>(value: T, delayMs = 250): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
