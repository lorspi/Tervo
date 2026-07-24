import { Sun, Moon } from 'lucide-react';
import { useAppStore } from '../store';

export function ThemeToggle() {
  const theme = useAppStore(s => s.theme);
  const setTheme = useAppStore(s => s.setTheme);

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggle = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggle}
      className="w-8 h-8 rounded-lg bg-card border border-border shadow-card flex items-center justify-center text-foreground hover:bg-accent transition-all duration-300 ease-out cursor-pointer"
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
