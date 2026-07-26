import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface UIContextValue {
  toast: (message: string, type?: ToastType) => void;
  confirm: (options: { title: string; message: string; variant?: 'danger' | 'default' }) => Promise<boolean>;
}

const UIContext = createContext<UIContextValue | null>(null);

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}

interface ConfirmState {
  title: string;
  message: string;
  variant: 'danger' | 'default';
  resolve: (val: boolean) => void;
}

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const confirm = useCallback((options: { title: string; message: string; variant?: 'danger' | 'default' }): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({ ...options, variant: options.variant || 'default', resolve });
    });
  }, []);

  const handleConfirm = (result: boolean) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  // Close confirm dialog with ESC key
  useEffect(() => {
    if (!confirmState) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleConfirm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmState]);

  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case 'success': return 'border-bento-green text-bento-green';
      case 'error': return 'border-destructive text-destructive';
      case 'warning': return 'border-bento-yellow text-bento-yellow';
      case 'info': return 'border-bento-blue text-bento-blue';
    }
  };

  const getToastIcon = (type: ToastType) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="w-4 h-4 shrink-0" />;
      case 'error': return <XCircle className="w-4 h-4 shrink-0" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 shrink-0" />;
      case 'info': return <Info className="w-4 h-4 shrink-0" />;
    }
  };

  return (
    <UIContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 border rounded-xl px-4 py-2.5 shadow-card-hover text-xs font-semibold font-body max-w-xs animate-fade-in bg-card ${getToastStyles(t.type)} pointer-events-auto`}
          >
            {getToastIcon(t.type)}
            <span className="text-foreground flex-1">{t.message}</span>
          </div>
        ))}
      </div>

      {/* Confirm Dialog */}
      {confirmState && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-foreground/20 backdrop-blur-[2px] animate-fade-in" onClick={() => handleConfirm(false)}>
          <div className="bg-card border border-border rounded-2xl shadow-card-hover w-full max-w-sm mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-sm font-bold text-foreground font-heading">{confirmState.title}</h2>
            </div>
            <p className="px-5 pb-5 text-xs text-muted-foreground leading-relaxed">{confirmState.message}</p>
            <div className="flex gap-2 px-5 pb-5 justify-end">
              <button
                onClick={() => handleConfirm(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-secondary hover:bg-accent border border-border text-foreground transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleConfirm(true)}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                  confirmState.variant === 'danger'
                    ? 'bg-destructive hover:opacity-90 text-white'
                    : 'bg-primary hover:opacity-90 text-primary-foreground'
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  );
}
