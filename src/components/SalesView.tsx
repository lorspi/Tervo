import React, { useState, useMemo } from 'react';
import { SystemState, Sale, Product, Client } from '../types';
import { 
  Search, Eye, Edit2, FileText, Printer, ArrowLeft, Trash2, Plus, Minus,
  AlertTriangle, Check, User, Calendar, CreditCard, ShoppingBag
} from 'lucide-react';
import { useAppStore } from '../store';
import { useUI } from './UIProvider';

interface SalesViewProps {
  state: SystemState;
  onUpdateState: (newState: SystemState) => void;
}

export default function SalesView({ state, onUpdateState }: SalesViewProps) {
  const { toast } = useUI();
  const { updateSale, addAuditLog: storeAuditLog } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [sessionFilter, setSessionFilter] = useState<string>('current_or_last'); // 'all' | 'current_or_last' | specificId
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<Sale | null>(null);
  
  // Editing Sales States
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editClient, setEditClient] = useState<string>('');
  const [editItems, setEditItems] = useState<Sale['items']>([]);

  // Find latest session
  const latestSession = useMemo(() => {
    if (state.cashSessions.length === 0) return null;
    return state.cashSessions[0]; // ordered latest first by db.ts generator or sorting
  }, [state.cashSessions]);

  // Determine filtering behavior
  const filteredSales = useMemo(() => {
    return state.sales.filter(sale => {
      // 1. Session Filter
      if (sessionFilter === 'current_or_last') {
        const activeId = state.currentSessionId || (latestSession ? latestSession.id : null);
        if (activeId && sale.cashSessionId !== activeId) {
          return false;
        }
      } else if (sessionFilter !== 'all') {
        if (sale.cashSessionId !== sessionFilter) {
          return false;
        }
      }

      // 2. Search search text (code, client name, cashier)
      const matchesSearch = 
        sale.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sale.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.cashierName.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });
  }, [state.sales, sessionFilter, state.currentSessionId, latestSession, searchTerm]);

  // Format Helpers
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Receipt printing handler
  const triggerPrintReceipt = (sale: Sale) => {
    setSelectedSaleForReceipt(sale);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Open Edit Sale modal
  const handleStartEditSale = (sale: Sale) => {
    setEditingSale(sale);
    setEditClient(sale.clientId || '');
    setEditItems(JSON.parse(JSON.stringify(sale.items))); // deep clone
  };

  // Edit sale items counters
  const handleUpdateEditItemQty = (productId: string, increment: number) => {
    setEditItems(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.quantity + increment);
        return {
          ...item,
          quantity: newQty,
          subtotal: newQty * item.price
        };
      }
      return item;
    }));
  };

  const handleRemoveEditItem = (productId: string) => {
    // Keep at least 1 item in the sale
    if (editItems.length <= 1) {
      toast("La venta debe contener al menos 1 producto.", 'warning');
      return;
    }
    setEditItems(prev => prev.filter(item => item.productId !== productId));
  };

  // Save the Edited Sale
  const handleSaveSaleEdits = async () => {
    if (!editingSale) return;

    const client = state.clients.find(c => c.id === editClient);
    const clientName = client ? client.name : 'Cliente General';
    const itemsSubtotal = editItems.reduce((acc, item) => acc + item.subtotal, 0);

    // Recalculate proportionally
    const originalPayable = editingSale.totalPayable;
    const ratio = editingSale.subtotal > 0 ? (itemsSubtotal / editingSale.subtotal) : 1;
    
    const newSubtotal = itemsSubtotal;
    const newCommissions = Math.round(editingSale.totalCommissions * ratio);
    const newFees = editingSale.totalFees;
    const newPayable = newSubtotal + newCommissions + newFees;

    const newPayments = editingSale.payments.map(pay => {
      const pRatio = originalPayable > 0 ? (pay.amount / originalPayable) : 1;
      return {
        ...pay,
        amount: Math.round(newPayable * pRatio)
      };
    });

    // Fix rounding
    const totalPaymentsSum = newPayments.reduce((acc, p) => acc + p.amount, 0);
    const roundingDiff = newPayable - totalPaymentsSum;
    if (roundingDiff !== 0 && newPayments.length > 0) {
      newPayments[0].amount += roundingDiff;
    }

    try {
      await updateSale(editingSale.id, {
        clientId: editClient || undefined,
        clientName,
        items: editItems,
        subtotal: newSubtotal,
        totalCommissions: newCommissions,
        totalFees: newFees,
        totalPayable: newPayable,
        payments: newPayments,
      });

      await storeAuditLog('inventory',
        `Venta ${editingSale.code} editada por ${state.currentUser?.name}. Cliente actualizado a "${clientName}".`
      );

      setEditingSale(null);
      toast("Venta editada y existencias actualizadas con éxito.");
    } catch (err: any) {
      toast(err.message || 'Error al editar la venta.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground uppercase tracking-wider">Registro de Ventas</h2>
          <p className="text-xs text-muted-foreground font-medium">Consulta, imprime boletas o edita transacciones del periodo.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:min-w-[260px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por código o cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-border rounded-xl text-xs bg-card placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring w-full"
            />
          </div>

          {/* Session Selector Filter */}
          <select
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-xl text-xs bg-card text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer font-semibold"
          >
            <option value="all">Todas las Ventas</option>
            <option value="current_or_last">Caja Actual / Última Caja</option>
            {state.cashSessions.map(sess => (
              <option key={sess.id} value={sess.id}>
                Cuadre #{sess.id.substring(sess.id.length - 8)} ({formatDate(sess.openDate).split(' ')[0]})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-secondary text-muted-foreground text-[10px] font-bold uppercase tracking-wider border-b border-border">
                <th className="p-4">Código</th>
                <th className="p-4">Fecha y Hora</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Vendedor</th>
                <th className="p-4">Items / Productos</th>
                <th className="p-4 text-right">Monto Neto</th>
                <th className="p-4 text-right">Comisiones / Tarifa</th>
                <th className="p-4 text-right font-bold">Total Cobrado</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-secondary/20">
                  <td className="p-4 font-mono font-bold text-foreground uppercase">{sale.code}</td>
                  <td className="p-4 text-muted-foreground font-semibold font-mono whitespace-nowrap">{formatDate(sale.date)}</td>
                  <td className="p-4 font-bold text-foreground uppercase">{sale.clientName || 'Cliente General'}</td>
                  <td className="p-4 text-muted-foreground font-semibold uppercase">{sale.cashierName}</td>
                  <td className="p-4 text-muted-foreground font-medium max-w-xs truncate" title={sale.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}>
                    {sale.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}
                  </td>
                  <td className="p-4 text-right font-mono text-muted-foreground">{formatMoney(sale.subtotal)}</td>
                  <td className="p-4 text-right font-mono text-muted-foreground">
                    {formatMoney(sale.totalCommissions + sale.totalFees)}
                  </td>
                  <td className="p-4 text-right font-mono font-bold text-foreground">{formatMoney(sale.totalPayable)}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => triggerPrintReceipt(sale)}
                        className="p-1.5 hover:bg-secondary text-muted-foreground hover:text-foreground rounded-xl transition-colors cursor-pointer"
                        title="Imprimir Boleta PDF"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleStartEditSale(sale)}
                        className="p-1.5 hover:bg-secondary text-muted-foreground hover:text-foreground rounded-xl transition-colors cursor-pointer"
                        title="Editar Venta"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center p-12 text-muted-foreground italic">
                    No se encontraron registros de ventas para los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT SALE MODAL */}
      {editingSale && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-card-hover border border-border max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-border bg-secondary flex items-center justify-between">
              <h3 className="font-bold text-foreground">Editar Venta: {editingSale.code}</h3>
              <button onClick={() => setEditingSale(null)} className="text-muted-foreground hover:text-muted-foreground">&times;</button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Client Edit */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Cliente Asignado</label>
                <select
                  value={editClient}
                  onChange={(e) => setEditClient(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Cliente General</option>
                  {state.clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.document ? `(${c.document})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Productos en la Venta</label>
                <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                  {editItems.map((item) => (
                    <div key={item.productId} className="p-3 bg-secondary/50 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">Precio Unitario: {formatMoney(item.price)}</p>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {/* Quantity Counter */}
                        <div className="flex items-center border border-border rounded-xl bg-card overflow-hidden">
                          <button
                            type="button"
                            onClick={() => handleUpdateEditItemQty(item.productId, -1)}
                            className="p-1 hover:bg-secondary text-muted-foreground"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="px-3 text-xs font-mono font-bold text-foreground">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateEditItemQty(item.productId, 1)}
                            className="p-1 hover:bg-secondary text-muted-foreground"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Delete single item */}
                        <button
                          type="button"
                          onClick={() => handleRemoveEditItem(item.productId)}
                          className="p-1 text-muted-foreground hover:text-destructive rounded"
                          title="Quitar producto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Calculation breakdown preview */}
              <div className="bg-secondary p-4 rounded-xl space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Subtotal Anterior:</span>
                  <span className="font-mono">{formatMoney(editingSale.subtotal)}</span>
                </div>
                <div className="flex justify-between font-semibold text-foreground border-t border-border pt-2 text-md">
                  <span>Nuevo Subtotal Neto:</span>
                  <span className="font-mono">{formatMoney(editItems.reduce((acc, item) => acc + item.subtotal, 0))}</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-normal mt-2 italic">
                  *Las comisiones y totales cobrados por método de pago serán recalculadas proporcionalmente al guardar esta modificación.
                </p>
              </div>

            </div>

            <div className="p-4 border-t border-border bg-secondary flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingSale(null)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveSaleEdits}
                className="px-4 py-2 bg-primary hover:bg-primary text-primary-foreground rounded-xl text-xs font-semibold transition-colors flex items-center"
              >
                <Check className="h-3.5 w-3.5 mr-1.5" />
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRISTINE HIDDEN PRINT CONTAINER (TICKET STYLE) */}
      <div className="hidden">
        {state.sales.map(sale => (
          <div 
            key={`print-receipt-${sale.id}`} 
            id={`print-receipt-content-${sale.id}`} 
            className="print:block p-8 bg-card text-foreground font-mono text-xs w-[300px] mx-auto space-y-6"
            style={{ fontFamily: 'monospace' }}
          >
            {/* Header */}
            <div className="text-center space-y-1">
              <h1 className="text-base font-bold uppercase tracking-wider">{state.config.storeName}</h1>
              <p className="text-[10px] text-muted-foreground whitespace-pre-line leading-tight">{state.config.storeInfo}</p>
            </div>

            <hr className="border-dashed border-slate-300" />

            {/* Ticket Metadata */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>BOLETA:</span>
                <span className="font-bold">{sale.code}</span>
              </div>
              <div className="flex justify-between">
                <span>FECHA:</span>
                <span>{formatDate(sale.date)}</span>
              </div>
              <div className="flex justify-between">
                <span>CAJERO:</span>
                <span className="uppercase">{sale.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>CLIENTE:</span>
                <span className="uppercase">{sale.clientName || 'CLIENTE GENERAL'}</span>
              </div>
            </div>

            <hr className="border-dashed border-slate-300" />

            {/* Products Table */}
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="w-1/2">PRODUCTO</span>
                <span className="w-1/6 text-center">CANT</span>
                <span className="w-1/3 text-right">TOTAL</span>
              </div>
              <div className="space-y-1">
                {sale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start">
                    <span className="w-1/2 break-all">{item.name}</span>
                    <span className="w-1/6 text-center">{item.quantity}</span>
                    <span className="w-1/3 text-right">{formatMoney(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>

            <hr className="border-dashed border-slate-300" />

            {/* Financial Breakdown */}
            <div className="space-y-1 text-right">
              <div className="flex justify-between">
                <span>SUBTOTAL NETO:</span>
                <span>{formatMoney(sale.subtotal)}</span>
              </div>
              {sale.totalCommissions + sale.totalFees > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>CARGO/COMISIÓN:</span>
                  <span>{formatMoney(sale.totalCommissions + sale.totalFees)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm border-t border-dashed border-slate-300 pt-1">
                <span>TOTAL A PAGAR:</span>
                <span>{formatMoney(sale.totalPayable)}</span>
              </div>
            </div>

            <hr className="border-dashed border-slate-300" />

            {/* Payments breakdown */}
            <div className="space-y-1">
              <p className="font-bold text-[10px]">DETALLE PAGOS:</p>
              {sale.payments.map((p, i) => (
                <div key={i} className="flex justify-between text-[10px]">
                  <span>{p.methodName}:</span>
                  <span>{formatMoney(p.amount)}</span>
                </div>
              ))}
            </div>

            <hr className="border-dashed border-slate-300" />

            <div className="text-center text-[10px] space-y-1 pt-2">
              <p className="font-bold">¡GRACIAS POR SU COMPRA!</p>
              <p className="text-muted-foreground">Desarrollado en Entorno POS Local</p>
            </div>
          </div>
        ))}
      </div>

      {/* Global CSS Inject to support isolated ticket printing */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          /* Only display the triggered content container */
          [id^="print-receipt-content-"] {
            display: none !important;
          }
          /* Set target print element visible */
          ${selectedSaleForReceipt ? `#print-receipt-content-${selectedSaleForReceipt.id}, #print-receipt-content-${selectedSaleForReceipt.id} *` : ''} {
            visibility: visible !important;
            display: block !important;
          }
          ${selectedSaleForReceipt ? `#print-receipt-content-${selectedSaleForReceipt.id}` : ''} {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}} />

    </div>
  );
}
