import { FolderOpen, HardDrive, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../store';
import { ThemeToggle } from './ThemeToggle';

export default function LoadFolderScreen() {
  const selectFolder = useAppStore(s => s.selectFolder);
  const fsaSupported = 'showDirectoryPicker' in window;

  if (!fsaSupported) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl p-5 sm:p-8 shadow-card-hover max-w-md w-full text-center space-y-5">
          <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6 text-destructive" />
          </div>
          <h1 className="text-lg font-bold text-foreground font-heading">Navegador No Compatible</h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Esta aplicación requiere la File System Access API que solo está disponible en
            <strong className="text-foreground"> Google Chrome 86+</strong> o
            <strong className="text-foreground"> Microsoft Edge 86+</strong>.
          </p>
          <p className="text-xs text-muted-foreground">
            Por favor, abre esta aplicación en uno de esos navegadores.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative glows */}
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-bento-blue/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-bento-green/10 rounded-full blur-3xl" />

      {/* Theme toggle */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 sm:p-8 shadow-card-hover max-w-md w-full relative z-10 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-3 mb-8">
          <div className="flex items-center justify-center mx-auto">
            <img src="/logo-light.svg" alt="Logo" className="h-14 block dark:hidden" />
            <img src="/logo-dark.svg" alt="Logo" className="h-14 hidden dark:block" />
          </div>
          <h1 className="text-2xl font-bold text-foreground font-heading">Sistema POS</h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Punto de Venta offline-first. Todos tus datos se almacenan en una carpeta local de tu equipo.
          </p>
        </div>

        {/* Action Card */}
        <button
          onClick={selectFolder}
          className="w-full border border-border rounded-2xl p-5 cursor-pointer hover:border-bento-blue/60 hover:shadow-card-hover transition-all duration-300 text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-bento-blue-light flex items-center justify-center text-bento-blue shrink-0 group-hover:scale-105 transition-transform">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div className="space-y-1 min-w-0">
              <h3 className="text-sm font-bold text-foreground font-heading">Seleccionar Carpeta</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Elige una carpeta vacía para iniciar un nuevo proyecto o una carpeta existente con datos POS.
              </p>
            </div>
          </div>
        </button>

        {/* Info footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground">
          <HardDrive className="w-3.5 h-3.5" />
          <span className="font-mono text-[10px] tracking-wide">OFFLINE-FIRST • DATOS LOCALES • SIN SERVIDOR</span>
        </div>
      </div>
    </div>
  );
}
