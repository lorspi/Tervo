import React, { useEffect, useState, useMemo } from 'react';
import {
  LayoutDashboard, FileText, ShoppingCart, Package, Users,
  CreditCard, Settings, LogOut, Lock, Unlock, Menu, X
} from 'lucide-react';

import { useAppStore, applyTheme } from './store';
import { SystemState, Sale } from './types';

import { ThemeToggle } from './components/ThemeToggle';
import LoadFolderScreen from './components/LoadFolderScreen';
import DashboardView from './components/DashboardView';
import ReportsView from './components/ReportsView';
import SalesView from './components/SalesView';
import InventoryView from './components/InventoryView';
import ClientsView from './components/ClientsView';
import PaymentMethodsView from './components/PaymentMethodsView';
import UsersView from './components/UsersView';
import SettingsView from './components/SettingsView';
import OpenCloseSessionModal from './components/OpenCloseSessionModal';
import NewSaleModal from './components/NewSaleModal';

type ActiveView = 'dashboard' | 'reports' | 'sales' | 'inventory' | 'clients' | 'payments' | 'users' | 'settings';

export default function App() {
  const {
    adapter, isLoading, data, currentUser, currentSessionId,
    initialize, login, logout, updateData, addAuditLog, backgroundReload, closeProject, theme
  } = useAppStore();

  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [isOpenSessionOpen, setIsOpenSessionOpen] = useState(false);
  const [isCloseSessionOpen, setIsCloseSessionOpen] = useState(false);
  const [printableSale, setPrintableSale] = useState<Sale | null>(null);

  // Initialize app and apply theme
  useEffect(() => {
    initialize();
    applyTheme(theme);
  }, []);

  // Background reload polling (every 7 seconds)
  useEffect(() => {
    if (!adapter) return;
    const interval = setInterval(() => {
      backgroundReload();
    }, 7000);
    return () => clearInterval(interval);
  }, [adapter, backgroundReload]);

  // Active cash session
  const activeSession = useMemo(() => {
    if (!currentSessionId) return null;
    return data.cashSessions.find(s => s.id === currentSessionId) || null;
  }, [data.cashSessions, currentSessionId]);

  // Handle state updates (bridge for child components)
  const handleUpdateState = (newState: SystemState) => {
    updateData(newState);
  };

  // Build state object for child components (keeping backward compatibility)
  const state: SystemState = useMemo(() => ({
    ...data,
    currentUser,
    currentSessionId,
  }), [data, currentUser, currentSessionId]);

  // Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const error = login(loginUsername.trim(), loginPassword);
    if (error) {
      setLoginError(error);
    } else {
      addAuditLog('system_status', `Sesión iniciada por ${loginUsername.trim()}`);
      setLoginUsername('');
      setLoginPassword('');
    }
  };

  // Logout
  const handleLogout = () => {
    if (currentUser) {
      addAuditLog('system_status', `Sesión cerrada por ${currentUser.name}`);
    }
    logout();
    setActiveView('dashboard');
    setIsMobileMenuOpen(false);
  };

  // Menu items based on role
  const menuItems = useMemo(() => {
    const role = currentUser?.role;
    const items = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'reports', label: 'Reportes y Cierres', icon: FileText },
      { id: 'sales', label: 'Registro Ventas', icon: ShoppingCart },
      { id: 'inventory', label: 'Inventario', icon: Package },
      { id: 'clients', label: 'Clientes', icon: Users },
    ];
    if (role === 'admin') {
      items.push(
        { id: 'payments', label: 'Métodos de Pago', icon: CreditCard },
        { id: 'users', label: 'Usuarios / Cajeros', icon: Users },
        { id: 'settings', label: 'Configuración', icon: Settings },
      );
    }
    return items;
  }, [currentUser]);

  // Render active view
  const renderActiveViewContent = () => {
    switch (activeView) {
      case 'dashboard': return <DashboardView state={state} />;
      case 'reports': return <ReportsView state={state} />;
      case 'sales': return <SalesView state={state} onUpdateState={handleUpdateState} />;
      case 'inventory': return <InventoryView state={state} onUpdateState={handleUpdateState} />;
      case 'clients': return <ClientsView state={state} onUpdateState={handleUpdateState} />;
      case 'payments': return <PaymentMethodsView state={state} onUpdateState={handleUpdateState} />;
      case 'users': return <UsersView state={state} onUpdateState={handleUpdateState} />;
      case 'settings': return <SettingsView state={state} onUpdateState={handleUpdateState} />;
      default: return <DashboardView state={state} />;
    }
  };

  const handleTriggerSalePrint = (sale: Sale) => {
    setPrintableSale(sale);
    setTimeout(() => {
      window.print();
      setPrintableSale(null);
    }, 250);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-xs text-muted-foreground font-semibold">Cargando...</p>
        </div>
      </div>
    );
  }

  // No folder selected - show folder selection screen
  if (!adapter) {
    return <LoadFolderScreen />;
  }

  // Not logged in - show login
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
        {/* Theme toggle */}
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
          <div className="mx-auto flex items-center justify-center">
            <img src="/logo-light.svg" alt="Logo" className="h-14 block dark:hidden" />
            <img src="/logo-dark.svg" alt="Logo" className="h-14 hidden dark:block" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-heading">{data.config.storeName}</h2>
          <p className="text-xs text-muted-foreground">Inicia sesión para registrar ventas o administrar el negocio.</p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-card border border-border rounded-2xl py-8 px-6 shadow-card-hover space-y-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Usuario de Acceso</label>
                <input
                  type="text"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Ej: vendedor"
                  className="w-full bg-secondary border border-input rounded-xl px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Contraseña</label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="•••••"
                  className="w-full bg-secondary border border-input rounded-xl px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                />
              </div>

              {loginError && (
                <p className="text-xs text-destructive font-semibold leading-normal">{loginError}</p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-primary hover:opacity-90 text-primary-foreground font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Ingresar al Sistema
              </button>
            </form>

            {/* Change folder button */}
            <div className="border-t border-border pt-4">
              <button
                onClick={closeProject}
                className="w-full text-center text-[10px] text-muted-foreground hover:text-foreground font-semibold transition-colors cursor-pointer"
              >
                ← Cambiar carpeta de datos
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main app layout
  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden font-body print:bg-white">
      {/* Mobile Header */}
      <header className="lg:hidden flex items-center justify-between px-3 py-2 border-b border-border bg-card print:hidden">
        <div className="flex items-center gap-2">
          <img src="/icon.svg" alt="Logo" className="h-5 w-5" />
          <span className="font-bold text-sm truncate max-w-[150px] font-heading">{data.config.storeName}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] bg-secondary px-2 py-0.5 rounded-full font-semibold border border-border">
            {currentUser.name.split(' ')[0]}
          </span>
          <ThemeToggle />
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-foreground hover:text-muted-foreground cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-row overflow-hidden min-h-0">
        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-30 w-64 flex flex-col border-r border-border bg-card transform transition-transform duration-300 ease-out print:hidden
          lg:translate-x-0 lg:static lg:h-auto
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex-1 flex flex-col p-5 space-y-5 overflow-y-auto">
            {/* Brand */}
            <div className="flex items-center gap-3 pb-4 border-b border-border">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0">
                <img src="/icon.svg" alt="Logo" className="h-9 w-9" />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-sm leading-snug truncate font-heading">{data.config.storeName}</h1>
                <span className="text-[10px] text-muted-foreground font-mono tracking-widest">POS OFFLINE</span>
              </div>
            </div>

            {/* Cash session status */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground tracking-widest">ESTADO DE CAJA</p>
              {activeSession ? (
                <div className="bg-bento-green-light border border-bento-green/20 p-3 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 text-bento-green text-xs font-semibold">
                    <Unlock className="h-3.5 w-3.5 shrink-0" />
                    <span>Caja Abierta</span>
                  </div>
                  <button
                    onClick={() => setIsCloseSessionOpen(true)}
                    className="w-full text-center py-1.5 bg-bento-green hover:opacity-90 text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                  >
                    Cuadre y Cerrar
                  </button>
                </div>
              ) : (
                <div className="bg-bento-orange-light border border-bento-orange/20 p-3 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 text-bento-orange text-xs font-semibold">
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    <span>Turno Cerrado</span>
                  </div>
                  <button
                    onClick={() => setIsOpenSessionOpen(true)}
                    className="w-full text-center py-1.5 bg-bento-orange hover:opacity-90 text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                  >
                    Apertura Caja
                  </button>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-muted-foreground tracking-widest">MÓDULOS</p>
              <nav className="space-y-1">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveView(item.id as ActiveView);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 py-2 px-3 rounded-xl text-xs font-medium transition-all duration-300 cursor-pointer ${
                        isActive
                          ? 'bg-primary text-primary-foreground font-semibold shadow-card'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* User info footer */}
          <div className="p-4 border-t border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-bento-blue flex items-center justify-center text-xs font-bold text-white shrink-0">
                {currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{currentUser.name}</p>
                <p className="text-[10px] text-muted-foreground font-bold">
                  {currentUser.role === 'admin' ? 'Admin' : 'Vendedor'}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 hover:bg-accent text-muted-foreground hover:text-destructive rounded-lg transition-colors cursor-pointer"
              title="Cerrar Sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </aside>

        {/* Mobile overlay */}
        {isMobileMenuOpen && (
          <div
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-foreground/20 backdrop-blur-[2px] z-20 lg:hidden print:hidden"
          />
        )}

        {/* Main content */}
        <main className="flex-1 flex flex-col h-full bg-background overflow-hidden min-w-0">
          {/* Top bar */}
          <header className="h-14 border-b border-border flex items-center justify-between px-4 sm:px-6 shrink-0 print:hidden bg-card">
            <div>
              <h1 className="text-sm font-bold text-foreground font-heading">
                {activeView === 'dashboard' && "Dashboard"}
                {activeView === 'reports' && "Reportes e Historial"}
                {activeView === 'sales' && "Registro de Ventas"}
                {activeView === 'inventory' && "Inventario"}
                {activeView === 'clients' && "Clientes"}
                {activeView === 'payments' && "Métodos de Pago"}
                {activeView === 'users' && "Usuarios y Cajeros"}
                {activeView === 'settings' && "Configuración"}
              </h1>
              <p className="text-[10px] text-muted-foreground font-medium">
                {activeSession ? `Caja Abierta` : 'Caja Cerrada'} • Datos locales
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => {
                  if (!currentSessionId) {
                    setIsOpenSessionOpen(true);
                    return;
                  }
                  setIsNewSaleOpen(true);
                }}
                className="bg-bento-green hover:opacity-90 text-white px-3.5 py-1.5 rounded-xl shadow-card text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">NUEVA VENTA</span>
                <span className="sm:hidden">VENTA</span>
              </button>

              <div className="hidden lg:block">
                <ThemeToggle />
              </div>
            </div>
          </header>

          {/* Scrollable content */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto print:p-0 print:bg-white">
            <div className="animate-fade-in">
              {renderActiveViewContent()}
            </div>
          </div>

          {/* Footer */}
          <footer className="h-9 border-t border-border px-4 sm:px-6 flex items-center justify-between text-[10px] text-muted-foreground font-semibold shrink-0 print:hidden bg-card">
            <div className="flex items-center gap-3">
              <span className="font-mono tracking-wider">POS TERVO</span>
              <span className="flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${activeSession ? 'bg-bento-green animate-pulse-slow' : 'bg-bento-orange'}`} />
                {activeSession ? 'Operativa' : 'Fuera de turno'}
              </span>
            </div>
            <span className="hidden sm:block font-mono">
              {new Date().toLocaleDateString('es-CL', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          </footer>
        </main>
      </div>

      {/* Modals */}
      <OpenCloseSessionModal
        state={state}
        onUpdateState={handleUpdateState}
        isOpenModal={isOpenSessionOpen}
        isCloseModal={isCloseSessionOpen}
        onClose={() => { setIsOpenSessionOpen(false); setIsCloseSessionOpen(false); }}
      />
      <NewSaleModal
        state={state}
        onUpdateState={handleUpdateState}
        isOpen={isNewSaleOpen}
        onClose={() => setIsNewSaleOpen(false)}
        onTriggerPrint={handleTriggerSalePrint}
      />

      {/* Print receipt (hidden) */}
      {printableSale && (
        <div className="hidden print:block p-8 bg-white text-foreground font-mono text-xs w-[300px] mx-auto space-y-4">
          <div className="text-center space-y-1">
            <h1 className="text-base font-bold uppercase">{data.config.storeName}</h1>
            <p className="text-[10px] whitespace-pre-line leading-tight">{data.config.storeInfo}</p>
          </div>
          <hr className="border-dashed border-border" />
          <div className="space-y-1">
            <div className="flex justify-between"><span>BOLETA:</span><span className="font-bold">{printableSale.code}</span></div>
            <div className="flex justify-between"><span>FECHA:</span><span>{new Date(printableSale.date).toLocaleDateString('es-CL')}</span></div>
            <div className="flex justify-between"><span>CAJERO:</span><span>{printableSale.cashierName}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
