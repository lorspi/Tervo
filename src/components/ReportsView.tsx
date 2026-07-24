import React, { useState, useMemo } from 'react';
import { SystemState, CashSession, Sale, AuditLog } from '../types';
import { 
  Calendar, FileText, Download, Printer, ChevronRight, ChevronDown, 
  DollarSign, Clock, User, CheckCircle2, AlertCircle, ShoppingBag, ArrowUpDown
} from 'lucide-react';

interface ReportsViewProps {
  state: SystemState;
}

export default function ReportsView({ state }: ReportsViewProps) {
  const [activeTab, setActiveTab] = useState<'sessions' | 'logs'>('sessions');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  
  // Search and filter states for audit logs
  const [logSearch, setLogSearch] = useState('');
  const [logTypeFilter, setLogTypeFilter] = useState<string>('all');

  // Find selected session
  const selectedSession = useMemo(() => {
    return state.cashSessions.find(s => s.id === selectedSessionId) || null;
  }, [state.cashSessions, selectedSessionId]);

  // Find sales for selected session
  const sessionSales = useMemo(() => {
    if (!selectedSessionId) return [];
    return state.sales.filter(sale => sale.cashSessionId === selectedSessionId);
  }, [state.sales, selectedSessionId]);

  // Generate hourly sales chart data for selected session
  const hourlyChartData = useMemo(() => {
    if (!selectedSessionId) return [];
    
    // Group sales by hour
    const hourlyMap: Record<number, number> = {};
    
    // Pre-populate standard hours or just use existing hours in session
    sessionSales.forEach(sale => {
      const hour = new Date(sale.date).getHours();
      hourlyMap[hour] = (hourlyMap[hour] || 0) + sale.totalPayable;
    });

    const hours = Object.keys(hourlyMap).map(Number).sort((a, b) => a - b);
    return hours.map(hour => ({
      hour: `${hour}:00`,
      total: hourlyMap[hour]
    }));
  }, [sessionSales, selectedSessionId]);

  // Filter audit logs
  const filteredLogs = useMemo(() => {
    return state.auditLogs.filter(log => {
      const matchesSearch = 
        log.username.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.details.toLowerCase().includes(logSearch.toLowerCase());
      
      const matchesType = logTypeFilter === 'all' || log.actionType === logTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [state.auditLogs, logSearch, logTypeFilter]);

  // Format Helpers
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'inventory': return 'Inventario';
      case 'payment_method': return 'Métodos de pago';
      case 'config': return 'Configuración';
      case 'user': return 'Usuarios';
      case 'client': return 'Clientes';
      case 'system_status': return 'Estado Sistema';
      default: return action;
    }
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'inventory': return 'bg-bento-blue-light text-blue-700 border-blue-100';
      case 'payment_method': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'config': return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'user': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'client': return 'bg-teal-50 text-teal-700 border-teal-100';
      default: return 'bg-secondary text-foreground border-border';
    }
  };

  // CSV Exporter for Session
  const exportSessionCSV = (session: CashSession, sales: Sale[]) => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += `REPORTE DE CAJA - ID: ${session.id}\r\n`;
    csvContent += `Fecha Apertura,${session.openDate}\r\n`;
    csvContent += `Fecha Cierre,${session.closeDate || 'Abierta'}\r\n`;
    csvContent += `Abierta por,${session.openedByName}\r\n`;
    csvContent += `Efectivo Inicial,${session.initialCash}\r\n\r\n`;
    
    csvContent += `MÉTODO DE PAGO,ESPERADO (SISTEMA),REAL (REPORTADO),DIFERENCIA\r\n`;
    state.paymentMethods.forEach(pm => {
      const expected = session.expectedAmounts[pm.id] || 0;
      const real = session.realAmounts ? (session.realAmounts[pm.id] || 0) : expected;
      const diff = session.discrepancies ? (session.discrepancies[pm.id] || 0) : 0;
      csvContent += `"${pm.name}",${expected},${real},${diff}\r\n`;
    });
    
    csvContent += `\r\nVENTAS REALIZADAS\r\n`;
    csvContent += `CODIGO,FECHA,CLIENTE,SUBTOTAL,COMISIONES,TOTAL PAGADO,METODO DE PAGO\r\n`;
    sales.forEach(sale => {
      const pmNames = sale.payments.map(p => `${p.methodName}: ${p.amount}`).join(' | ');
      csvContent += `${sale.code},${sale.date},"${sale.clientName || 'General'}",${sale.subtotal},${sale.totalCommissions + sale.totalFees},${sale.totalPayable},"${pmNames}"\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reporte_caja_${session.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Exporter for Audit Logs
  const exportLogsCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += `HISTORIAL DE MOVIMIENTOS Y CAMBIOS EN SISTEMA\r\n`;
    csvContent += `FECHA,USUARIO,TIPO,DESCRIPCION\r\n`;
    
    filteredLogs.forEach(log => {
      csvContent += `${log.date},"${log.username}","${getActionLabel(log.actionType)}","${log.details.replace(/"/g, '""')}"\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `historial_movimientos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Browser Printing handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Tab Selectors */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-2">
        <div className="flex space-x-6">
          <button
            onClick={() => { setActiveTab('sessions'); setSelectedSessionId(null); }}
            className={`pb-3 font-bold text-xs uppercase tracking-wider transition-all relative cursor-pointer ${
              activeTab === 'sessions' ? 'text-foreground border-b-2 border-blue-600' : 'text-muted-foreground hover:text-muted-foreground'
            }`}
          >
            Arqueos de Caja
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-3 font-bold text-xs uppercase tracking-wider transition-all relative cursor-pointer ${
              activeTab === 'logs' ? 'text-foreground border-b-2 border-blue-600' : 'text-muted-foreground hover:text-muted-foreground'
            }`}
          >
            Historial de Movimientos
          </button>
        </div>
        
        {/* Quick CSV export for logs */}
        {activeTab === 'logs' && (
          <button
            onClick={exportLogsCSV}
            className="flex items-center px-4 py-2 bg-slate-900 hover:bg-primary text-primary-foreground rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 mr-2" />
            Exportar CSV
          </button>
        )}
      </div>

      {/* SECTION 1: CASH SESSIONS */}
      {activeTab === 'sessions' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* SESSIONS LIST */}
          <div className="lg:col-span-1 bg-card border border-border rounded-xl overflow-hidden shadow-card h-fit">
            <div className="p-4 border-b border-border bg-secondary/75">
              <h3 className="font-bold text-xs uppercase tracking-wider text-foreground">Registros de Turno</h3>
              <p className="text-[10px] text-muted-foreground font-medium">Historial completo por fecha.</p>
            </div>
            
            <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
              {state.cashSessions.map((session) => {
                const isSelected = selectedSessionId === session.id;
                return (
                  <button
                    key={session.id}
                    onClick={() => setSelectedSessionId(session.id)}
                    className={`w-full text-left p-4 hover:bg-secondary/50 transition-colors flex items-center justify-between cursor-pointer ${
                      isSelected ? 'bg-bento-blue-light/20 border-r-4 border-blue-600' : ''
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-muted-foreground">#{session.id.substring(session.id.length - 8)}</span>
                        {session.status === 'open' ? (
                          <span className="text-[8px] bg-bento-green-light text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded-sm font-bold tracking-wider uppercase">
                            ABIERTA
                          </span>
                        ) : (
                          <span className="text-[8px] bg-secondary text-muted-foreground border border-border px-1.5 py-0.2 rounded-sm font-bold tracking-wider uppercase">
                            CERRADA
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-foreground">{formatDate(session.openDate)}</p>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase flex items-center">
                        <User className="h-3 w-3 mr-1" />
                        {session.openedByName}
                      </p>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isSelected ? 'translate-x-1 text-bento-blue' : ''}`} />
                  </button>
                );
              })}

              {state.cashSessions.length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  No hay cierres de caja registrados aún.
                </div>
              )}
            </div>
          </div>

          {/* SESSION DETAILS PANEL */}
          <div className="lg:col-span-2">
            {selectedSession ? (
              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card print:border-none print:shadow-none">
                
                {/* Print-only CSS block to support pristine PDF receipt printing */}
                <style dangerouslySetInnerHTML={{__html: `
                  @media print {
                    body * {
                      visibility: hidden;
                    }
                    #print-report-area, #print-report-area * {
                      visibility: visible;
                    }
                    #print-report-area {
                      position: absolute;
                      left: 0;
                      top: 0;
                      width: 100%;
                    }
                  }
                `}} />

                <div id="print-report-area" className="p-6 space-y-6">
                  {/* Detail Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Turno de Caja Detallado</h2>
                        <span className="font-mono text-xs text-muted-foreground">ID #{selectedSession.id.substring(selectedSession.id.length - 8)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground font-semibold">Iniciado el {formatDate(selectedSession.openDate)}</p>
                    </div>

                    <div className="flex items-center gap-2 print:hidden">
                      <button
                        onClick={() => exportSessionCSV(selectedSession, sessionSales)}
                        className="p-2 border border-border hover:bg-secondary rounded-xl text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        title="Exportar a CSV"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handlePrint}
                        className="p-2 border border-border hover:bg-secondary rounded-xl text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        title="Imprimir Reporte"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Info Blocks */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-secondary/50 border border-border p-4 rounded-xl shadow-2xs">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Efectivo Inicial</p>
                      <p className="text-lg font-black text-foreground mt-1 font-mono">{formatMoney(selectedSession.initialCash)}</p>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase mt-1">Cajero: {selectedSession.openedByName}</p>
                    </div>

                    <div className="bg-secondary/50 border border-border p-4 rounded-xl shadow-2xs">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Estado y Cierre</p>
                      {selectedSession.status === 'open' ? (
                        <div className="flex items-center gap-1.5 mt-2 text-bento-green font-bold text-xs uppercase tracking-wider">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Turno Abierto</span>
                        </div>
                      ) : (
                        <div className="mt-1">
                          <p className="text-xs font-bold text-foreground">Cierre: {selectedSession.closeDate ? formatDate(selectedSession.closeDate) : '-'}</p>
                          <p className="text-[10px] text-muted-foreground font-semibold uppercase mt-1">Saldado por: {selectedSession.closedByName || '-'}</p>
                        </div>
                      )}
                    </div>

                    <div className="bg-secondary/50 border border-border p-4 rounded-xl shadow-2xs col-span-1 sm:col-span-2 md:col-span-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Recaudado Neto</p>
                      <p className="text-lg font-black text-foreground mt-1 font-mono">{formatMoney(sessionSales.reduce((acc, s) => acc + s.totalPayable, 0))}</p>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase mt-1">{sessionSales.length} transacciones registradas</p>
                    </div>
                  </div>

                  {/* Method Balancing / Discrepancies */}
                  <div className="border border-border rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-secondary text-muted-foreground text-[10px] uppercase font-bold tracking-wider border-b border-border">
                          <th className="p-3">Método de Pago</th>
                          <th className="p-3 text-right">Esperado (Sistema)</th>
                          <th className="p-3 text-right">Real (Arqueo)</th>
                          <th className="p-3 text-right font-bold">Diferencia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-foreground">
                        {state.paymentMethods.map(pm => {
                          const expected = selectedSession.expectedAmounts[pm.id] || 0;
                          const real = selectedSession.realAmounts ? (selectedSession.realAmounts[pm.id] ?? expected) : expected;
                          const discrepancy = selectedSession.discrepancies ? (selectedSession.discrepancies[pm.id] ?? 0) : 0;
                          
                          return (
                            <tr key={pm.id} className="hover:bg-secondary/30">
                              <td className="p-3 font-semibold text-foreground uppercase tracking-wide text-[11px]">{pm.name}</td>
                              <td className="p-3 text-right font-mono text-muted-foreground">{formatMoney(expected)}</td>
                              <td className="p-3 text-right font-mono font-medium text-foreground">
                                {selectedSession.status === 'open' ? (
                                  <span className="text-muted-foreground italic text-[11px]">En proceso</span>
                                ) : (
                                  formatMoney(real)
                                )}
                              </td>
                              <td className={`p-3 text-right font-mono font-bold ${
                                discrepancy === 0 ? 'text-bento-green' : discrepancy > 0 ? 'text-bento-blue' : 'text-rose-650'
                              }`}>
                                {selectedSession.status === 'open' ? (
                                  <span className="text-muted-foreground font-normal italic">-</span>
                                ) : discrepancy === 0 ? (
                                  <span className="text-bento-green bg-bento-green-light px-2 py-0.5 border border-emerald-100 rounded-sm font-bold text-[9px] uppercase tracking-wider">Cuadrado</span>
                                ) : (
                                  `${discrepancy > 0 ? '+' : ''}${formatMoney(discrepancy)}`
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Hourly Sales Graph (Custom lightweight clean SVG) */}
                  {sessionSales.length > 0 && (
                    <div className="bg-secondary/50 border border-border p-5 rounded-xl">
                      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center">
                        <Clock className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        Distribución de Ventas por Hora
                      </h4>
                      {hourlyChartData.length > 0 ? (
                        <div className="h-44 w-full flex items-end justify-between pt-4 gap-2.5">
                          {hourlyChartData.map((data, i) => {
                            const maxTotal = Math.max(...hourlyChartData.map(d => d.total));
                            const heightPercent = maxTotal > 0 ? (data.total / maxTotal) * 100 : 0;
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-1.5 bg-gray-900 text-primary-foreground text-[10px] font-bold font-mono py-1 px-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-md z-10 border border-gray-800">
                                  {formatMoney(data.total)}
                                </div>
                                {/* Bar */}
                                <div 
                                  className="w-full bg-bento-blue hover:bg-blue-700 rounded-t-sm transition-all duration-300 shadow-3xs" 
                                  style={{ height: `${Math.max(heightPercent, 5)}%` }}
                                />
                                <span className="text-[9px] text-muted-foreground font-bold mt-2 font-mono">{data.hour}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-xs text-muted-foreground italic">No hay suficientes datos temporales de ventas para graficar.</div>
                      )}
                    </div>
                  )}

                  {/* Sales details under this session */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center">
                      <ShoppingBag className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                      Ventas Registradas en este Turno ({sessionSales.length})
                    </h4>

                    <div className="overflow-x-auto border border-border rounded-xl shadow-2xs">
                      <table className="w-full text-left text-xs text-foreground">
                        <thead>
                          <tr className="bg-secondary text-muted-foreground font-bold border-b border-border text-[10px] uppercase tracking-wider">
                            <th className="p-3">Código</th>
                            <th className="p-3">Hora</th>
                            <th className="p-3">Cliente</th>
                            <th className="p-3">Productos</th>
                            <th className="p-3 text-right">Neto</th>
                            <th className="p-3 text-right">Comisiones</th>
                            <th className="p-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {sessionSales.map((sale) => (
                            <tr key={sale.id} className="hover:bg-secondary/20">
                              <td className="p-3 font-bold text-foreground font-mono text-[11px] uppercase">{sale.code}</td>
                              <td className="p-3 text-muted-foreground font-semibold font-mono">
                                {new Date(sale.date).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="p-3 font-bold text-foreground text-[11px] uppercase">{sale.clientName || 'Cliente General'}</td>
                              <td className="p-3 text-muted-foreground font-medium max-w-xs truncate">
                                {sale.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}
                              </td>
                              <td className="p-3 text-right font-mono text-muted-foreground">{formatMoney(sale.subtotal)}</td>
                              <td className="p-3 text-right font-mono text-muted-foreground">{formatMoney(sale.totalCommissions + sale.totalFees)}</td>
                              <td className="p-3 text-right font-bold font-mono text-foreground">{formatMoney(sale.totalPayable)}</td>
                            </tr>
                          ))}

                          {sessionSales.length === 0 && (
                            <tr>
                              <td colSpan={7} className="text-center p-8 text-muted-foreground italic">No se realizaron ventas durante este turno.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              <div className="bg-secondary border-2 border-dashed border-border rounded-xl p-16 flex flex-col items-center justify-center text-center text-muted-foreground h-full">
                <FileText className="h-12 w-12 text-gray-300 mb-4" />
                <h3 className="font-bold text-foreground text-xs uppercase tracking-wider">Selecciona un Turno de Caja</h3>
                <p className="text-xs mt-1.5 max-w-xs text-muted-foreground font-medium leading-normal">Escoge un registro de la lista de la izquierda para desplegar el arqueo de cuentas, auditoría y gráfico consolidado.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* SECTION 2: AUDIT LOGS / MOVEMENTS */}
      {activeTab === 'logs' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
          {/* Filter Bar */}
          <div className="p-4 bg-secondary/75 border-b border-border flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto flex-1">
              {/* Search */}
              <input
                type="text"
                placeholder="Buscar por usuario o cambio..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="px-3 py-1.5 border border-border rounded-xl text-xs bg-card placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring flex-1 sm:max-w-xs"
              />
              {/* Category selector */}
              <select
                value={logTypeFilter}
                onChange={(e) => setLogTypeFilter(e.target.value)}
                className="px-3 py-1.5 border border-border rounded-xl text-xs bg-card text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer font-semibold"
              >
                <option value="all">Todos los Movimientos</option>
                <option value="inventory">Inventario</option>
                <option value="payment_method">Métodos de pago</option>
                <option value="config">Configuración</option>
                <option value="user">Usuarios</option>
                <option value="client">Clientes</option>
                <option value="system_status">Estado Sistema</option>
              </select>
            </div>
            
            <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Mostrando {filteredLogs.length} logs</span>
          </div>

          {/* Logs Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-secondary text-muted-foreground text-[10px] font-bold border-b border-border uppercase tracking-wider">
                  <th className="p-3">Fecha y Hora</th>
                  <th className="p-3">Usuario</th>
                  <th className="p-3">Área de Cambio</th>
                  <th className="p-3">Detalle de Modificación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-secondary/20">
                    <td className="p-3 whitespace-nowrap text-muted-foreground font-semibold font-mono">{formatDate(log.date)}</td>
                    <td className="p-3 font-bold text-foreground flex items-center gap-2 uppercase tracking-wide">
                      <div className="h-6 w-6 rounded-full bg-bento-blue-light border border-blue-100 flex items-center justify-center text-[9px] font-bold text-bento-blue">
                        {log.username.charAt(0).toUpperCase()}
                      </div>
                      <span>{log.username}</span>
                    </td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-0.5 text-[9px] font-extrabold border rounded-sm uppercase tracking-wider ${getActionBadgeColor(log.actionType)}`}>
                        {getActionLabel(log.actionType)}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground font-medium break-all sm:break-normal">{log.details}</td>
                  </tr>
                ))}

                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center p-12 text-muted-foreground italic">No se encontraron movimientos registrados en esta categoría o búsqueda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
