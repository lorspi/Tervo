import { useState, useMemo } from 'react';
import { SystemState, Product } from '../types';
import { TrendingUp, AlertTriangle, DollarSign, CreditCard, ShoppingCart, Percent } from 'lucide-react';

interface DashboardViewProps {
  state: SystemState;
}

type FilterType = 'today' | 'month' | 'session' | 'all';

export default function DashboardView({ state }: DashboardViewProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const monthStr = now.toISOString().substring(0, 7);

    return state.sales.filter(sale => {
      const saleDateStr = sale.date.split('T')[0];
      const saleMonthStr = sale.date.substring(0, 7);

      if (filter === 'today') return saleDateStr === todayStr;
      if (filter === 'month') return saleMonthStr === monthStr;
      if (filter === 'session') return state.currentSessionId ? sale.cashSessionId === state.currentSessionId : false;
      return true;
    });
  }, [state.sales, filter, state.currentSessionId]);

  const metrics = useMemo(() => {
    let totalSales = 0;
    let totalProfit = 0;
    const paymentMethodsSummary: Record<string, number> = {};

    state.paymentMethods.forEach(pm => { paymentMethodsSummary[pm.id] = 0; });

    filteredSales.forEach(sale => {
      totalSales += sale.totalPayable;
      sale.items.forEach(item => { totalProfit += (item.price - item.cost) * item.quantity; });
      sale.payments.forEach(payment => {
        paymentMethodsSummary[payment.methodId] = (paymentMethodsSummary[payment.methodId] || 0) + payment.amount;
      });
    });

    return { totalSales, totalProfit, paymentMethodsSummary, salesCount: filteredSales.length };
  }, [filteredSales, state.paymentMethods]);

  const lowStockProducts = useMemo(() => {
    return state.products.filter(p => p.stock <= state.config.lowStockAlert);
  }, [state.products, state.config.lowStockAlert]);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Title & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground font-heading">Dashboard de Control</h2>
          <p className="text-xs text-muted-foreground">Monitorea el rendimiento y alertas clave.</p>
        </div>

        <div className="bg-secondary p-1 rounded-xl inline-flex items-center self-start border border-border">
          {(['all', 'today', 'month', 'session'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              disabled={f === 'session' && !state.currentSessionId}
              className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                filter === f
                  ? 'bg-card text-foreground shadow-card font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              } ${f === 'session' && !state.currentSessionId ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {f === 'all' ? 'Todos' : f === 'today' ? 'Hoy' : f === 'month' ? 'Mes' : 'Turno'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Sales */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card transition-all duration-300 hover:shadow-card-hover">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground">TOTAL RECAUDADO</span>
              <h3 className="text-xl font-black text-foreground mt-1 font-mono">{formatMoney(metrics.totalSales)}</h3>
            </div>
            <div className="p-2.5 bg-bento-green-light text-bento-green rounded-xl">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-[10px] text-muted-foreground font-medium border-t border-border pt-3">
            <ShoppingCart className="h-3 w-3 mr-1.5 text-bento-green" />
            <span>{metrics.salesCount} ventas registradas</span>
          </div>
        </div>

        {/* Profit */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card transition-all duration-300 hover:shadow-card-hover">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground">UTILIDAD ESTIMADA</span>
              <h3 className="text-xl font-black text-bento-green mt-1 font-mono">{formatMoney(metrics.totalProfit)}</h3>
            </div>
            <div className="p-2.5 bg-bento-blue-light text-bento-blue rounded-xl">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-[10px] text-muted-foreground font-medium border-t border-border pt-3">
            <Percent className="h-3 w-3 mr-1.5 text-bento-green" />
            <span>Margen sobre costo</span>
          </div>
        </div>

        {/* Transactions */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card transition-all duration-300 hover:shadow-card-hover">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground">TRANSACCIONES</span>
              <h3 className="text-xl font-black text-foreground mt-1 font-mono">{metrics.salesCount}</h3>
            </div>
            <div className="p-2.5 bg-bento-yellow-light text-bento-yellow rounded-xl">
              <ShoppingCart className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-[10px] text-muted-foreground font-medium border-t border-border pt-3">
            Ticket promedio: <strong className="font-mono text-foreground">{metrics.salesCount > 0 ? formatMoney(metrics.totalSales / metrics.salesCount) : formatMoney(0)}</strong>
          </div>
        </div>
      </div>

      {/* Payment Methods & Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Payment breakdown */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <h2 className="text-xs font-bold text-muted-foreground mb-4 flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Ingresos por Método de Pago
          </h2>
          <div className="space-y-4">
            {state.paymentMethods.map(pm => {
              const amount = metrics.paymentMethodsSummary[pm.id] || 0;
              const percent = metrics.totalSales > 0 ? (amount / metrics.totalSales) * 100 : 0;
              return (
                <div key={pm.id} className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{pm.name}</span>
                      {pm.commissionPercent > 0 && (
                        <span className="text-[9px] bg-bento-orange-light text-bento-orange px-1.5 py-0.5 rounded-md font-bold">
                          {pm.commissionPercent}%
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-foreground font-mono">{formatMoney(amount)}</span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-bento-blue h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {state.paymentMethods.length === 0 && (
              <p className="text-center py-6 text-muted-foreground text-xs">No hay métodos configurados.</p>
            )}
          </div>
        </div>

        {/* Low stock */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <h2 className="text-xs font-bold text-muted-foreground mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Stock Crítico
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-destructive/10 text-destructive rounded-lg">
              Límite: {state.config.lowStockAlert}
            </span>
          </h2>

          <div className="overflow-y-auto max-h-[220px] space-y-2">
            {lowStockProducts.map((p: Product) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-xl border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors"
              >
                <div>
                  <h4 className="font-bold text-foreground text-xs">{p.name}</h4>
                  <span className="text-[10px] text-muted-foreground font-mono">SKU: {p.sku || '-'}</span>
                </div>
                <span className="font-extrabold text-destructive text-sm font-mono bg-destructive/10 px-2.5 py-0.5 rounded-lg">
                  {p.stock}
                </span>
              </div>
            ))}
            {lowStockProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <div className="p-3 bg-bento-green-light text-bento-green rounded-full mb-3">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold text-foreground">Inventario Óptimo</p>
                <p className="text-[10px] mt-1 text-muted-foreground">Todos los productos sobre el umbral de alerta.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
