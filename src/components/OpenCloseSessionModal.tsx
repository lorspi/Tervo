import React, { useState, useMemo } from 'react';
import { SystemState, CashSession } from '../types';
import { Check, AlertCircle } from 'lucide-react';
import { addAuditLog } from '../utils/db';

interface OpenCloseSessionModalProps {
  state: SystemState;
  onUpdateState: (newState: SystemState) => void;
  isOpenModal: boolean;
  isCloseModal: boolean;
  onClose: () => void;
}

export default function OpenCloseSessionModal({
  state,
  onUpdateState,
  isOpenModal,
  isCloseModal,
  onClose
}: OpenCloseSessionModalProps) {

  const [initialCash, setInitialCash] = useState<number>(10000);
  const [realAmounts, setRealAmounts] = useState<Record<string, number>>({});

  const activeSession = useMemo(() => {
    if (!state.currentSessionId) return null;
    return state.cashSessions.find(s => s.id === state.currentSessionId) || null;
  }, [state.cashSessions, state.currentSessionId]);

  const handleOpenCashBox = (e: React.FormEvent) => {
    e.preventDefault();
    if (initialCash < 0) return;

    const sessionId = 'caja_' + Date.now();
    const now = new Date();

    const expectedAmounts: Record<string, number> = {};
    state.paymentMethods.forEach(pm => {
      expectedAmounts[pm.id] = pm.name.toLowerCase().includes('efectivo') ? initialCash : 0;
    });

    const newSession: CashSession = {
      id: sessionId,
      openDate: now.toISOString(),
      openedBy: state.currentUser?.id || 'unknown',
      openedByName: state.currentUser?.name || 'Sistema',
      initialCash,
      expectedAmounts,
      status: 'open'
    };

    let newState: SystemState = {
      ...state,
      cashSessions: [newSession, ...state.cashSessions],
      currentSessionId: sessionId
    };

    newState = addAuditLog(newState, 'system_status',
      `Apertura de caja por ${state.currentUser?.name}. Efectivo inicial: $${initialCash}`
    );

    onUpdateState(newState);
    onClose();
  };

  React.useEffect(() => {
    if (isCloseModal && activeSession) {
      const initialReal: Record<string, number> = {};
      state.paymentMethods.forEach(pm => {
        initialReal[pm.id] = activeSession.expectedAmounts[pm.id] || 0;
      });
      setRealAmounts(initialReal);
    }
  }, [isCloseModal, activeSession, state.paymentMethods]);

  const handleCloseCashBox = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    const now = new Date();
    const discrepancies: Record<string, number> = {};

    state.paymentMethods.forEach(pm => {
      const expected = activeSession.expectedAmounts[pm.id] || 0;
      const real = realAmounts[pm.id] || 0;
      discrepancies[pm.id] = real - expected;
    });

    const updatedSessions = state.cashSessions.map(sess => {
      if (sess.id === activeSession.id) {
        return {
          ...sess,
          closeDate: now.toISOString(),
          closedBy: state.currentUser?.id,
          closedByName: state.currentUser?.name,
          realAmounts,
          discrepancies,
          status: 'closed' as const
        };
      }
      return sess;
    });

    let newState: SystemState = {
      ...state,
      cashSessions: updatedSessions,
      currentSessionId: null
    };

    const totalDiscrepancy = Object.values(discrepancies).reduce((acc, v) => acc + v, 0);
    newState = addAuditLog(newState, 'system_status',
      `Cierre de caja por ${state.currentUser?.name}. Desajuste: ${totalDiscrepancy === 0 ? 'Sin diferencias' : `$${totalDiscrepancy}`}`
    );

    onUpdateState(newState);
    onClose();
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(amount);
  };

  if (!isOpenModal && !isCloseModal) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-foreground/20 backdrop-blur-[2px] animate-fade-in p-4">

      {/* OPEN CASH BOX */}
      {isOpenModal && (
        <form
          onSubmit={handleOpenCashBox}
          className="bg-card border border-border rounded-2xl shadow-card-hover max-w-sm w-full overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 className="text-sm font-bold text-foreground font-heading">Apertura de Caja</h3>
            <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg cursor-pointer">&times;</button>
          </div>

          <div className="px-5 pb-5 space-y-4">
            <div className="flex items-start gap-2.5 bg-secondary p-3 rounded-xl border border-border">
              <AlertCircle className="h-4 w-4 text-bento-blue shrink-0 mt-0.5" />
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Al abrir la caja inicias una nueva jornada de ventas. Configura el efectivo inicial para cambio/vuelto.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Efectivo Inicial ($)</label>
              <input
                type="number"
                min="0"
                required
                value={initialCash}
                onChange={(e) => setInitialCash(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-secondary border border-input rounded-xl px-3 py-2 text-xs text-foreground font-mono font-bold focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex gap-2 px-5 pb-5 justify-end">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-secondary hover:bg-accent border border-border text-foreground transition-colors cursor-pointer">
              Cancelar
            </button>
            <button type="submit"
              className="px-4 py-2 text-xs font-bold rounded-xl bg-primary hover:opacity-90 text-primary-foreground transition-colors flex items-center gap-1.5 cursor-pointer">
              <Check className="h-3.5 w-3.5" />
              Abrir Caja
            </button>
          </div>
        </form>
      )}

      {/* CLOSE CASH BOX */}
      {isCloseModal && activeSession && (
        <form
          onSubmit={handleCloseCashBox}
          className="bg-card border border-border rounded-2xl shadow-card-hover max-w-md w-full overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 className="text-sm font-bold text-foreground font-heading">Cierre de Caja</h3>
            <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg cursor-pointer">&times;</button>
          </div>

          <div className="px-5 pb-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="bg-secondary p-4 rounded-xl flex items-center justify-between border border-border text-xs">
              <div>
                <p className="text-muted-foreground text-[10px] font-semibold">Abierta por</p>
                <p className="font-bold text-foreground mt-0.5">{activeSession.openedByName}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground text-[10px] font-semibold">Efectivo Inicial</p>
                <p className="font-bold text-foreground mt-0.5 font-mono">{formatMoney(activeSession.initialCash)}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground font-medium border-b border-border pb-2">
              Ingresa los montos reales contados para cuadrar:
            </p>

            <div className="space-y-3">
              {state.paymentMethods.filter(pm => pm.active).map(pm => {
                const expected = activeSession.expectedAmounts[pm.id] || 0;
                const real = realAmounts[pm.id] || 0;
                const diff = real - expected;

                return (
                  <div key={pm.id} className="space-y-1.5 bg-secondary/50 p-3 rounded-xl border border-border">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground">{pm.name}</span>
                      <span className="text-muted-foreground font-mono text-[10px]">Esperado: {formatMoney(expected)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        required
                        value={realAmounts[pm.id] ?? 0}
                        onChange={(e) => setRealAmounts(prev => ({ ...prev, [pm.id]: Math.max(0, parseInt(e.target.value) || 0) }))}
                        className="flex-1 bg-secondary border border-input rounded-xl px-3 py-1.5 text-xs text-foreground font-mono font-bold focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                      />
                      <div className="text-right min-w-[80px]">
                        <p className={`text-[10px] font-mono font-bold ${
                          diff === 0 ? 'text-bento-green' : diff > 0 ? 'text-bento-blue' : 'text-destructive'
                        }`}>
                          {diff === 0 ? 'Cuadrado' : `${diff > 0 ? '+' : ''}${formatMoney(diff)}`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 px-5 pb-5 justify-end">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-secondary hover:bg-accent border border-border text-foreground transition-colors cursor-pointer">
              Cancelar
            </button>
            <button type="submit"
              className="px-4 py-2 text-xs font-bold rounded-xl bg-primary hover:opacity-90 text-primary-foreground transition-colors flex items-center gap-1.5 cursor-pointer">
              <Check className="h-3.5 w-3.5" />
              Efectuar Cierre
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
