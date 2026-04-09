import { useEffect, useState } from 'react';

const STORAGE_KEY = 'vc-theme';

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    // 1. Preferência salva
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
    // 2. Preferência do SO
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  return { theme, toggleTheme, isDark: theme === 'dark' };
}