import React, { useState } from 'react';
import { SystemState, PaymentMethod } from '../types';
import { Plus, Edit2, Check, CreditCard, DollarSign, Percent, AlertCircle } from 'lucide-react';
import { addAuditLog } from '../utils/db';

interface PaymentMethodsViewProps {
  state: SystemState;
  onUpdateState: (newState: SystemState) => void;
}

export default function PaymentMethodsView({ state, onUpdateState }: PaymentMethodsViewProps) {
  // Create / Edit states
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formCommission, setFormCommission] = useState<number>(0);
  const [formFlatFee, setFormFlatFee] = useState<number>(0);
  const [formActive, setFormActive] = useState(true);

  const handleOpenEdit = (pm: PaymentMethod) => {
    setEditingMethod(pm);
    setFormName(pm.name);
    setFormCommission(pm.commissionPercent);
    setFormFlatFee(pm.flatFee);
    setFormActive(pm.active);
  };

  const handleOpenCreate = () => {
    setEditingMethod(null);
    setFormName('');
    setFormCommission(0);
    setFormFlatFee(0);
    setFormActive(true);
    setIsCreateOpen(true);
  };

  const handleSavePaymentMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) {
      alert("Por favor ingresa un nombre para el método de pago.");
      return;
    }

    let updatedMethods = [...state.paymentMethods];
    let logDetail = '';

    if (editingMethod) {
      updatedMethods = state.paymentMethods.map(pm => {
        if (pm.id === editingMethod.id) {
          return {
            ...pm,
            name: formName,
            commissionPercent: formCommission,
            flatFee: formFlatFee,
            active: formActive
          };
        }
        return pm;
      });
      logDetail = `Método de pago "${formName}" (ID: ${editingMethod.id}) editado por ${state.currentUser?.name}. Comisión: ${formCommission}%, Cargo Fijo: $${formFlatFee}, Activo: ${formActive ? 'Sí' : 'No'}`;
    } else {
      const newMethod: PaymentMethod = {
        id: 'pm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        name: formName,
        commissionPercent: formCommission,
        flatFee: formFlatFee,
        active: formActive
      };
      updatedMethods.push(newMethod);
      logDetail = `Nuevo método de pago "${formName}" creado por ${state.currentUser?.name}. Comisión: ${formCommission}%, Cargo Fijo: $${formFlatFee}`;
    }

    let newState: SystemState = {
      ...state,
      paymentMethods: updatedMethods
    };

    newState = addAuditLog(newState, 'payment_method', logDetail);
    onUpdateState(newState);

    setEditingMethod(null);
    setIsCreateOpen(false);
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-6">
      
      {/* Title & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Métodos de Pago</h1>
          <p className="text-sm text-muted-foreground">Configura las comisiones o costos fijos asociados a las transacciones de tu local.</p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center px-4 py-2 bg-primary hover:bg-primary text-primary-foreground rounded-xl text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Nuevo Método de Pago
        </button>
      </div>

      {/* Info helper block */}
      <div className="bg-secondary rounded-xl p-4 border border-border/60 flex items-start gap-2.5">
        <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-0.5 text-xs text-muted-foreground">
          <h4 className="font-bold text-foreground">Comisiones y Costos Fijos</h4>
          <p className="leading-normal">
            Al aplicar un método de pago con recargo, el sistema calcula de forma transparente un monto adicional a pagar para el cliente final. 
            Por ejemplo, si pagas con Tarjeta de Crédito, puedes cobrar el recargo bancario automáticamente en la boleta.
          </p>
        </div>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {state.paymentMethods.map((pm) => (
          <div 
            key={pm.id} 
            className={`bg-card border border-border rounded-xl p-6 shadow-xs relative flex flex-col justify-between group hover:border-slate-300 transition-all ${
              !pm.active ? 'opacity-50' : ''
            }`}
          >
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${pm.active ? 'bg-secondary text-foreground' : 'bg-secondary text-muted-foreground'}`}>
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-foreground leading-snug">{pm.name}</h3>
                </div>

                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  pm.active 
                    ? 'bg-bento-green-light text-emerald-700 border border-emerald-200' 
                    : 'bg-secondary text-muted-foreground'
                }`}>
                  {pm.active ? 'ACTIVO' : 'INACTIVO'}
                </span>
              </div>

              {/* Commission Config info */}
              <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-xs">
                <div className="space-y-0.5">
                  <p className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Porcentaje Comisión</p>
                  <p className="font-mono font-bold text-foreground flex items-center gap-1">
                    <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                    {pm.commissionPercent}%
                  </p>
                </div>

                <div className="space-y-0.5">
                  <p className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Cargo Fijo</p>
                  <p className="font-mono font-bold text-foreground flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    {formatMoney(pm.flatFee)}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-1.5 mt-6 pt-3 border-t border-border">
              <button
                onClick={() => handleOpenEdit(pm)}
                className="p-1.5 hover:bg-secondary text-muted-foreground rounded-xl transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                title="Editar tarifas"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>Configurar</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* CREATE OR EDIT MODAL */}
      {(editingMethod || isCreateOpen) && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <form 
            onSubmit={handleSavePaymentMethod}
            className="bg-card rounded-xl shadow-card-hover border border-border max-w-sm w-full overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-border bg-secondary flex items-center justify-between">
              <h3 className="font-bold text-foreground">
                {editingMethod ? `Editar Método de Pago: ${editingMethod.name}` : 'Nuevo Método de Pago'}
              </h3>
              <button 
                type="button" 
                onClick={() => { setEditingMethod(null); setIsCreateOpen(false); }} 
                className="text-muted-foreground hover:text-muted-foreground text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-sm">
              
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Nombre del Método *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Tarjeta de Crédito, WebPay, Cheque"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Commission Percent */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Porcentaje de Comisión (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  placeholder="Ej: 2.5"
                  value={formCommission}
                  onChange={(e) => setFormCommission(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-3 py-2 border border-border rounded-xl bg-card focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                />
                <p className="text-[10px] text-muted-foreground leading-normal">Se calcula un % extra sobre el subtotal neto de la venta.</p>
              </div>

              {/* Flat Fee */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Cargo Fijo de Uso ($)</label>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="Ej: 50"
                  value={formFlatFee}
                  onChange={(e) => setFormFlatFee(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 border border-border rounded-xl bg-card focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                />
                <p className="text-[10px] text-muted-foreground leading-normal">Se añade un cargo monetario estático al total por transaccionar con este método.</p>
              </div>

              {/* Status active switch */}
              <div className="flex items-center justify-between border-t border-border pt-3">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Habilitar Método de Pago</label>
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="h-4 w-4 text-foreground focus:ring-ring rounded border-border"
                />
              </div>

            </div>

            <div className="p-4 border-t border-border bg-secondary flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setEditingMethod(null); setIsCreateOpen(false); }}
                className="px-4 py-2 border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary hover:bg-primary text-primary-foreground rounded-xl text-xs font-semibold transition-colors flex items-center cursor-pointer"
              >
                <Check className="h-3.5 w-3.5 mr-1.5" />
                {editingMethod ? 'Actualizar Método' : 'Registrar Método'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
