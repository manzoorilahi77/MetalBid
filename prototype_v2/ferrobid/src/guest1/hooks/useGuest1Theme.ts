import { useCallback, useLayoutEffect, useState } from 'react';

/* Guest1 is a fully isolated app (see Guest1Gate.tsx) with its own token
   system gated on [data-theme="dark"] rather than the manager app's `.dark`
   class — the two mechanisms live on the same <html> element without
   colliding since neither side's CSS reads the other's selector. Storage key
   is scoped to guest1 so switching this doesn't touch the manager app's own
   theme (and vice versa). */
const STORAGE_KEY = 'guest1-theme';

function readStoredTheme(): 'light' | 'dark' {
  return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

export function useGuest1Theme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(readStoredTheme);

  // useLayoutEffect (not useEffect) so the attribute lands before the
  // browser paints — avoids a flash of the wrong theme on mount.
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme };
}
