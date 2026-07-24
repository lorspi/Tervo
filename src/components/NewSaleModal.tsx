import React, { useState, useMemo, useEffect } from 'react';
import { SystemState, Product, Client, Sale, SaleItem } from '../types';
import { 
  X, Search, Plus, Minus, Trash2, Check, User, ShoppingCart, 
  CreditCard, DollarSign, Percent, AlertCircle 
} from 'lucide-react';
import { addAuditLog } from '../utils/db';
import { useUI } from './UIProvider';

interface NewSaleModalProps {
  state: SystemState;
  onUpdateState: (newState: SystemState) => void;
  isOpen: boolean;
  onClose: () => void;
  onTriggerPrint: (sale: Sale) => void; // callback to let App trigger the boleta printable view instantly!
}

export default function NewSaleModal({ 
  state, 
  onUpdateState, 
  isOpen, 
  onClose,
  onTriggerPrint
}: NewSaleModalProps) {
  
  const { toast } = useUI();
  // Search state
  const [productSearch, setProductSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('c_generic'); // default general client
  
  // Cart state
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);

  // Split payments state: methodId -> amount paid
  const [payments, setPayments] = useState<Record<string, number>>({});

  // Reset modal when opened/closed
  useEffect(() => {
    if (isOpen) {
      setCart([]);
      setProductSearch('');
      setSelectedClientId('c_generic');
      setPayments({});
    }
  }, [isOpen]);

  // Search filtered products (search results dropdown/list)
  const productSearchResults = useMemo(() => {
    if (!productSearch.trim()) return [];
    
    const term = productSearch.toLowerCase();
    return state.products.filter(p => {
      return (
        p.name.toLowerCase().includes(term) ||
        (p.sku || '').toLowerCase().includes(term) ||
        p.barcode.includes(term) ||
        p.category.toLowerCase().includes(term)
      );
    }).slice(0, 5); // limit to 5 results for sleek dropdown
  }, [state.products, productSearch]);

  // Cart financial calculations
  const cartTotals = useMemo(() => {
    let subtotal = 0;
    let totalCommissions = 0;
    let totalFees = 0;

    cart.forEach(item => {
      subtotal += item.product.price * item.quantity;
    });

    // We calculate commissions/fees based on what payment method is actively allocated
    // For split payments, we calculate the commission *proportionally* to the amount allocated to each payment method!
    state.paymentMethods.forEach(pm => {
      const allocated = payments[pm.id] || 0;
      if (allocated > 0) {
        // Commission
        if (pm.commissionPercent > 0) {
          totalCommissions += allocated * (pm.commissionPercent / 100);
        }
        // Flat fee
        if (pm.flatFee > 0) {
          totalFees += pm.flatFee;
        }
      }
    });

    // Rounding
    totalCommissions = Math.round(totalCommissions);

    const totalPayable = subtotal + totalCommissions + totalFees;

    return {
      subtotal,
      totalCommissions,
      totalFees,
      totalPayable
    };
  }, [cart, payments, state.paymentMethods]);

  // Whenever cart totals change, default the primary cash payment to the remaining total payable
  // This satisfies: "Por defecto el total está en el método efectivo."
  useEffect(() => {
    const total = cartTotals.totalPayable;
    if (total === 0) {
      setPayments({});
      return;
    }

    // Check if user has already customized split payments manually
    const paymentValues = Object.values(payments) as number[];
    const hasCustomPayments = paymentValues.length > 0 && paymentValues.some(val => val > 0);

    if (!hasCustomPayments) {
      // Default all to Cash ('pm1')
      setPayments({
        pm1: total
      });
    } else {
      // If totals changed (e.g. products added/removed) and split payments exist, 
      // let's adjust the primary/first active payment to balance out, or let user adjust.
      // For simplicity, adjust the first method that currently has an amount to the correct balance,
      // or default back to Cash to avoid complex unresolved states.
      // Let's just adjust the current allocations proportionally or update Cash.
      // To satisfy: "Por defecto el total está en el método efectivo" as items change, if not manually split.
      // Let's check if pm1 is the only one. If yes, keep it fully updated.
      const allocatedTotal = (Object.values(payments) as number[]).reduce((acc, v) => acc + v, 0);
      if (payments.pm1 === allocatedTotal || Object.keys(payments).length === 1 && payments.pm1) {
        setPayments({ pm1: total });
      }
    }
  }, [cartTotals.totalPayable]);

  // Handle clicking on payment method title to shift total
  // "Al tocar cada título de los otros métodos el total se pasará al correspondiente y se borrará de los demás"
  const handleShiftTotalToPaymentMethod = (methodId: string) => {
    const total = cartTotals.totalPayable;
    if (total <= 0) return;

    setPayments({
      [methodId]: total
    });
  };

  // Add product to cart
  const handleAddToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast(`El producto "${product.name}" no cuenta con existencias en inventario actualmente (Stock: 0).`, 'warning');
      return;
    }

    // Find if already in cart
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        toast(`No puedes vender más de ${product.stock} unidades de "${product.name}" (Stock límite alcanzado).`, 'warning');
        return;
      }
      setCart(prev => prev.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart(prev => [...prev, { product, quantity: 1 }]);
    }

    setProductSearch(''); // clear search input after selecting
  };

  // Cart counters
  const handleUpdateCartQty = (productId: string, increment: number) => {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;

    const newQty = item.quantity + increment;
    if (newQty <= 0) {
      handleRemoveFromCart(productId);
      return;
    }

    if (newQty > item.product.stock) {
      toast(`No puedes agregar más unidades. El stock disponible de "${item.product.name}" es de ${item.product.stock} unidades.`, 'warning');
      return;
    }

    setCart(prev => prev.map(i => 
      i.product.id === productId ? { ...i, quantity: newQty } : i
    ));
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  };

  // Process manual amount input in split payments
  const handleUpdatePaymentAllocation = (methodId: string, val: number) => {
    setPayments(prev => ({
      ...prev,
      [methodId]: Math.max(0, val)
    }));
  };

  // Check split payments summing up to totalPayable
  const paymentSum = useMemo(() => {
    return (Object.values(payments) as number[]).reduce((acc, v) => acc + v, 0);
  }, [payments]);

  const paymentDifference = useMemo(() => {
    return cartTotals.totalPayable - paymentSum;
  }, [cartTotals.totalPayable, paymentSum]);

  // Submit Sale Handler
  const handleSubmitSale = (e: React.FormEvent) => {
    e.preventDefault();

    if (cart.length === 0) {
      toast("El carrito está vacío. Agrega al menos un producto.", 'warning');
      return;
    }

    if (paymentDifference !== 0) {
      toast(`Los montos ingresados para los métodos de pago ($${paymentSum}) no igualan el total a pagar del carrito ($${cartTotals.totalPayable}). Por favor, cuadra la diferencia de: $${paymentDifference}`, 'warning');
      return;
    }

    if (!state.currentSessionId) {
      toast("No hay un cuadre/turno de caja activo actualmente. Por favor, abre caja antes de realizar una venta.", 'warning');
      return;
    }

    // 1. Deduct Product Stocks in inventory
    const updatedProducts = state.products.map(p => {
      const cartItem = cart.find(item => item.product.id === p.id);
      if (cartItem) {
        return {
          ...p,
          stock: Math.max(0, p.stock - cartItem.quantity)
        };
      }
      return p;
    });

    // 2. Build Sale Object
    const client = state.clients.find(c => c.id === selectedClientId);
    const clientName = client ? client.name : 'Cliente General';
    
    const saleCode = 'V-' + String(state.sales.length + 1).padStart(4, '0');
    
    const saleItems: SaleItem[] = cart.map(item => ({
      productId: item.product.id,
      name: item.product.name,
      price: item.product.price,
      cost: item.product.cost,
      quantity: item.quantity,
      subtotal: item.product.price * item.quantity
    }));

    const paymentsList = (Object.entries(payments) as [string, number][])
      .filter(([_, amount]) => amount > 0)
      .map(([methodId, amount]) => {
        const pm = state.paymentMethods.find(p => p.id === methodId);
        return {
          methodId,
          methodName: pm ? pm.name : 'Otro',
          amount
        };
      });

    const newSale: Sale = {
      id: 'sale_' + Date.now(),
      code: saleCode,
      date: new Date().toISOString(),
      clientId: selectedClientId || undefined,
      clientName,
      items: saleItems,
      subtotal: cartTotals.subtotal,
      totalCommissions: cartTotals.totalCommissions,
      totalFees: cartTotals.totalFees,
      totalPayable: cartTotals.totalPayable,
      payments: paymentsList,
      cashierId: state.currentUser?.id || 'unknown',
      cashierName: state.currentUser?.name || 'Vendedor',
      cashSessionId: state.currentSessionId
    };

    // 3. Update active Cash Session's expected amounts by summing this sale's payments
    const updatedSessions = state.cashSessions.map(session => {
      if (session.id === state.currentSessionId) {
        const expectedAmounts = { ...session.expectedAmounts };
        
        paymentsList.forEach(p => {
          if (expectedAmounts[p.methodId] !== undefined) {
            expectedAmounts[p.methodId] += p.amount;
          } else {
            expectedAmounts[p.methodId] = p.amount;
          }
        });

        return {
          ...session,
          expectedAmounts
        };
      }
      return session;
    });

    // Update global state
    let newState: SystemState = {
      ...state,
      products: updatedProducts,
      sales: [newSale, ...state.sales],
      cashSessions: updatedSessions
    };

    // Log the transaction
    const logSummary = `Nueva Venta ${saleCode} completada por ${state.currentUser?.name} para el cliente "${clientName}". Total: $${cartTotals.totalPayable}. Productos vendidos: ${cart.map(i => `${i.quantity}x ${i.product.name}`).join(', ')}`;
    newState = addAuditLog(newState, 'inventory', logSummary);

    onUpdateState(newState);
    onClose();

    // Trigger instant print boleta feedback!
    setTimeout(() => {
      onTriggerPrint(newSale);
    }, 300);
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-foreground/20 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-2xl border border-border max-w-4xl w-full overflow-hidden flex flex-col md:flex-row h-[90vh]">
        
        {/* LEFT COLUMN: PRODUCT SEARCH & CART LIST */}
        <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto border-r border-border">
          <div className="space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                Nueva Venta POS
              </h2>
              <button onClick={onClose} className="md:hidden text-muted-foreground hover:text-muted-foreground text-lg">&times;</button>
            </div>

            {/* Optional Customer Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <User className="h-3 w-3" />
                Asociar Cliente (Opcional)
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full px-3 py-1.5 border border-border rounded-xl text-xs bg-card focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {state.clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.document ? `(${c.document})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Search & Dropdown */}
            <div className="space-y-1.5 relative">
              <label className="text-xs font-semibold text-muted-foreground uppercase block">Buscar Productos</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Escanea código o busca por nombre, SKU..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-border rounded-xl text-sm bg-card placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full"
                />
              </div>

              {/* Instant Dropdown Search Results */}
              {productSearchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-20 overflow-hidden divide-y divide-border">
                  {productSearchResults.map((p) => {
                    const isOutOfStock = p.stock <= 0;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddToCart(p)}
                        className="w-full text-left p-3 hover:bg-secondary flex items-center justify-between text-xs transition-colors"
                        disabled={isOutOfStock}
                      >
                        <div className="space-y-0.5">
                          <p className="font-semibold text-foreground">{p.name}</p>
                          <p className="text-muted-foreground font-mono">Barcode: {p.barcode} | Cat: {p.category}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-foreground">{formatMoney(p.price)}</p>
                          <p className={`font-semibold ${isOutOfStock ? 'text-destructive' : 'text-muted-foreground'}`}>
                            Stock: {p.stock}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase border-b border-border pb-1.5">Artículos agregados al Carrito ({cart.length})</p>
              
              <div className="divide-y divide-border max-h-[35vh] overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.product.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{item.product.name}</p>
                      <p className="text-muted-foreground font-mono">{formatMoney(item.product.price)} c/u | Stock: {item.product.stock}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Plus Minus Counter */}
                      <div className="flex items-center border border-border rounded-xl bg-card overflow-hidden shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateCartQty(item.product.id, -1)}
                          className="p-1 hover:bg-secondary text-muted-foreground"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="px-2 font-mono font-bold text-foreground">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateCartQty(item.product.id, 1)}
                          className="p-1 hover:bg-secondary text-muted-foreground"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Total and delete */}
                      <span className="font-mono font-bold text-foreground min-w-[65px] text-right">
                        {formatMoney(item.product.price * item.quantity)}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(item.product.id)}
                        className="p-1 text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {cart.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground italic">
                    El carrito de compras está vacío. Comienza buscando un producto arriba.
                  </div>
                )}
              </div>
            </div>

          </div>
          
          <p className="text-[10px] text-muted-foreground border-t border-border pt-3 italic">
            *Las existencias de productos serán descontadas automáticamente al finalizar la venta.
          </p>
        </div>

        {/* RIGHT COLUMN: FINANCIAL BREAKDOWN & PAYMENT SELECTOR */}
        <div className="w-full md:w-[350px] bg-secondary p-6 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground text-sm">Resumen de Pago</h3>
              <button onClick={onClose} className="hidden md:block text-muted-foreground hover:text-muted-foreground text-lg">&times;</button>
            </div>

            {/* Financial Totals */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Neto Productos:</span>
                <span className="font-mono">{formatMoney(cartTotals.subtotal)}</span>
              </div>
              {cartTotals.totalCommissions > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Comisión Métodos:</span>
                  <span className="font-mono">{formatMoney(cartTotals.totalCommissions)}</span>
                </div>
              )}
              {cartTotals.totalFees > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Cargo Fijo Recargo:</span>
                  <span className="font-mono">{formatMoney(cartTotals.totalFees)}</span>
                </div>
              )}
              <hr className="border-border my-1" />
              <div className="flex justify-between font-bold text-foreground text-base">
                <span>Total a Cobrar:</span>
                <span className="font-mono text-bento-green">{formatMoney(cartTotals.totalPayable)}</span>
              </div>
            </div>

            {/* Payment Method splitter inputs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase">
                <span>Métodos de Pago</span>
                <span className="text-[10px] italic text-muted-foreground">(Toca título para pago total)</span>
              </div>
              
              <div className="space-y-2.5">
                {state.paymentMethods.filter(pm => pm.active).map(pm => {
                  const amount = payments[pm.id] || 0;
                  return (
                    <div key={pm.id} className="bg-card border border-border rounded-xl p-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        {/* Shifter Title trigger click */}
                        <button
                          type="button"
                          onClick={() => handleShiftTotalToPaymentMethod(pm.id)}
                          className="font-bold text-xs text-foreground hover:text-foreground border-b border-dashed border-slate-300 hover:border-slate-800 text-left"
                          title="Pasar el total completo a este método de pago"
                        >
                          {pm.name}
                        </button>
                        {pm.commissionPercent > 0 && (
                          <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1 py-0.2 rounded-sm font-semibold">
                            +{pm.commissionPercent}%
                          </span>
                        )}
                      </div>

                      {/* Amount Input */}
                      <div className="relative mt-1">
                        <span className="absolute left-2.5 top-1.5 text-muted-foreground font-bold text-xs">$</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={payments[pm.id] || ''}
                          onChange={(e) => handleUpdatePaymentAllocation(pm.id, parseInt(e.target.value) || 0)}
                          className="w-full pl-5 pr-3 py-1 border border-border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-ring text-foreground font-bold font-mono text-right bg-secondary/20"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ledger balancing feedback widget */}
            {cartTotals.totalPayable > 0 && (
              <div className={`p-3 rounded-xl flex items-start gap-2 border text-xs leading-snug ${
                paymentDifference === 0 
                  ? 'bg-bento-green-light border-emerald-200 text-emerald-800' 
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  {paymentDifference === 0 ? (
                    <p className="font-semibold">Monto cuadrado. Boleta lista para ser emitida.</p>
                  ) : paymentDifference > 0 ? (
                    <p>Falta ingresar <span className="font-bold font-mono">{formatMoney(paymentDifference)}</span> para completar el saldo de pago.</p>
                  ) : (
                    <p>Sobrante de <span className="font-bold font-mono">{formatMoney(Math.abs(paymentDifference))}</span>. Ajuste los montos ingresados.</p>
                  )}
                </div>
              </div>
            )}

          </div>

          <div className="pt-6 border-t border-border space-y-2">
            <button
              onClick={handleSubmitSale}
              disabled={cart.length === 0 || paymentDifference !== 0}
              className={`w-full py-2.5 text-primary-foreground font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                cart.length === 0 || paymentDifference !== 0
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary'
              }`}
            >
              <Check className="h-4 w-4" />
              Emitir Venta y Boleta PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 bg-transparent hover:bg-slate-200/50 text-muted-foreground rounded-xl text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
