import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { currentMonthKey, isValidMonthKey } from '../lib/budgetMath';

/** Gekozen maand staat in de URL (?m=2026-10), zodat terugnavigeren en delen werken. */
export function useMonthParam(): [string, (next: string) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get('m');
  const month = raw !== null && isValidMonthKey(raw) ? raw : currentMonthKey();
  const setMonth = useCallback(
    (next: string) => {
      const p = new URLSearchParams(params);
      if (next === currentMonthKey()) {
        p.delete('m');
      } else {
        p.set('m', next);
      }
      setParams(p, { replace: true });
    },
    [params, setParams],
  );
  return [month, setMonth];
}
