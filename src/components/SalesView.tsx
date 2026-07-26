import React, { useState, useMemo, useRef } from 'react';
import { SystemState, Sale, Product, Client } from '../types';
import { 
  Search, Eye, Edit2, FileText, ArrowLeft, Trash2, Plus, Minus,
  AlertTriangle, Check, User, Calendar, CreditCard, ShoppingBag, X, UserPlus
} from 'lucide-react';
import { useAppStore } from '../store';
import { useUI } from './UIProvider';
import Portal from './Portal';

interface SalesViewProps {
  state: SystemState;
  onUpdateState: (newState: SystemState) => void;
}

export default function SalesView({ state, onUpdateState }: SalesViewProps) {
  const { toast } = useUI();
  const { updateSale, createClient, addAuditLog: storeAuditLog } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [sessionFilter, setSessionFilter] = useState<string>('current_or_last');
  
  // Editing Sales States
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editClient, setEditClient] = useState<string>('');
  const [editClientName, setEditClientName] = useState<string>('');
  const [editClientSearch, setEditClientSearch] = useState('');
  const [isEditClientDropdownOpen, setIsEditClientDropdownOpen] = useState(false);
  const [isNewClientFormOpen, setIsNewClientFormOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientDocument, setNewClientDocument] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const editClientInputRef = useRef<HTMLInputElement>(null);
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

  // Open Edit Sale modal
  // Edit client search results
  const editClientSearchResults = useMemo(() => {
    if (!editClientSearch.trim()) return state.clients.slice(0, 5);
    const term = editClientSearch.toLowerCase();
    return state.clients.filter(c => 
      c.name.toLowerCase().includes(term) ||
      (c.document || '').toLowerCase().includes(term) ||
      (c.phone || '').toLowerCase().includes(term)
    ).slice(0, 5);
  }, [state.clients, editClientSearch]);

  const handleStartEditSale = (sale: Sale) => {
    setEditingSale(sale);
    setEditClient(sale.clientId || '');
    setEditClientName(sale.clientName || '');
    setEditClientSearch('');
    setIsEditClientDropdownOpen(false);
    setIsNewClientFormOpen(false);
    setEditItems(JSON.parse(JSON.stringify(sale.items)));
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

    const clientName = editClientName || undefined;
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
        <Portal>
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-card-hover border border-border max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-border bg-secondary flex items-center justify-between">
              <h3 className="font-bold text-foreground">Editar Venta: {editingSale.code}</h3>
              <button onClick={() => setEditingSale(null)} className="text-muted-foreground hover:text-muted-foreground">&times;</button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Client Edit */}
              <div className="space-y-1.5 relative">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Cliente (Opcional)</label>
                {editClient ? (
                  <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl bg-secondary">
                    <span className="text-xs font-semibold text-foreground flex-1">{editClientName}</span>
                    <button
                      type="button"
                      onClick={() => { setEditClient(''); setEditClientName(''); setEditClientSearch(''); }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      ref={editClientInputRef}
                      type="text"
                      placeholder="Buscar cliente por nombre o documento..."
                      value={editClientSearch}
                      onChange={(e) => { setEditClientSearch(e.target.value); setIsEditClientDropdownOpen(true); }}
                      onFocus={() => setIsEditClientDropdownOpen(true)}
                      className="w-full pl-8 pr-3 py-2 border border-border rounded-xl text-xs bg-card placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                )}

                {/* Client search dropdown */}
                {isEditClientDropdownOpen && !editClient && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-20 overflow-hidden max-h-[200px] overflow-y-auto">
                    {editClientSearchResults.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setEditClient(c.id);
                          setEditClientName(c.name);
                          setEditClientSearch('');
                          setIsEditClientDropdownOpen(false);
                        }}
                        className="w-full text-left p-2.5 hover:bg-secondary flex items-center justify-between text-xs transition-colors border-b border-border last:border-0"
                      >
                        <div>
                          <p className="font-semibold text-foreground">{c.name}</p>
                          {c.document && <p className="text-[10px] text-muted-foreground">{c.document}</p>}
                        </div>
                        {c.phone && <span className="text-[10px] text-muted-foreground">{c.phone}</span>}
                      </button>
                    ))}
                    {editClientSearchResults.length === 0 && editClientSearch.trim() && (
                      <p className="text-xs text-muted-foreground text-center py-3 italic">Sin resultados</p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditClientDropdownOpen(false);
                        setIsNewClientFormOpen(true);
                        setNewClientName(editClientSearch);
                      }}
                      className="w-full text-left p-2.5 hover:bg-bento-blue-light flex items-center gap-2 text-xs font-semibold text-bento-blue transition-colors border-t border-border"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Agregar nuevo cliente
                    </button>
                  </div>
                )}
              </div>

              {/* New Client inline form */}
              {isNewClientFormOpen && (
                <div className="bg-secondary border border-border rounded-xl p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-foreground">Nuevo Cliente</h4>
                    <button type="button" onClick={() => setIsNewClientFormOpen(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Nombre completo *"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-border rounded-lg text-xs bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="RUT / Documento"
                        value={newClientDocument}
                        onChange={(e) => setNewClientDocument(e.target.value)}
                        className="w-full px-3 py-1.5 border border-border rounded-lg text-xs bg-card focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                      />
                      <input
                        type="text"
                        placeholder="Teléfono"
                        value={newClientPhone}
                        onChange={(e) => setNewClientPhone(e.target.value)}
                        className="w-full px-3 py-1.5 border border-border rounded-lg text-xs bg-card focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newClientName.trim()) return;
                      try {
                        await createClient({
                          name: newClientName.trim(),
                          document: newClientDocument || undefined,
                          phone: newClientPhone || undefined,
                        });
                        const { data } = useAppStore.getState();
                        const created = data.clients.find(c => c.name === newClientName.trim());
                        if (created) {
                          setEditClient(created.id);
                          setEditClientName(created.name);
                        }
                        setIsNewClientFormOpen(false);
                        setNewClientName('');
                        setNewClientDocument('');
                        setNewClientPhone('');
                        setEditClientSearch('');
                      } catch (err: any) {
                        toast(err.message || 'Error al crear cliente.', 'error');
                      }
                    }}
                    className="w-full py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer hover:opacity-90"
                  >
                    <Check className="h-3 w-3" />
                    Registrar y Seleccionar
                  </button>
                </div>
              )}

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
        </Portal>
      )}

    </div>
  );
}
