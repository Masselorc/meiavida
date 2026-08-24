import { useCallback, useEffect, useState } from 'react';

export function useClock(
  enabled: boolean,
  intervalMs = 1_000,
): readonly [number, () => void] {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return undefined;

    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs]);

  const refresh = useCallback(() => setNow(Date.now()), []);
  return [now, refresh] as const;
}
