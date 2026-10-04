import { useEffect, useState } from 'react';

/** Reactieve media query; standaardwaarde is de huidige match (geen flikkering bij eerste render). */
export function useMediaQuery(query: string): boolean {
  const get = () => (typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);

  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) {
      return;
    }
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Desktopindeling vanaf 720 px (zie tailwind.config.ts, breakpoint md). */
export const useIsDesktop = () => useMediaQuery('(min-width: 720px)');
