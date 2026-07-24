import { create } from 'zustand';
import {
  authApi, usersApi, productsApi, clientsApi, paymentMethodsApi,
  salesApi, cashSessionsApi, configApi, auditLogsApi,
  setAuthToken, getAuthToken, getTerminalId, getTerminalName
} from './utils/api';
import { User, Product, Client, PaymentMethod, Sale, CashSession, AuditLog, SystemConfig, AuditLogAction, SystemState } from './types';

const DEFAULT_CONFIG: SystemConfig = {
  lowStockAlert: 5,
  storeName: 'Mi Tienda POS',
  storeInfo: '',
};

export interface AppStore {
  // Connection state
  isLoading: boolean;
  isConnected: boolean;
  connectionError: string | null;
  serverUrl: string;

  // App data
  data: SystemState;

  // UI
  currentUser: User | null;
  currentSessionId: string | null;
  terminalId: string;
  theme: 'light' | 'dark' | 'system';

  // Actions
  initialize: () => Promise<void>;
  setServerUrl: (url: string) => void;

  // Auth
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;

  // Data loading
  loadAllData: () => Promise<void>;
  refreshData: () => Promise<void>;

  // CRUD operations (now async, hit the API)
  createUser: (user: Omit<User, 'id'>) => Promise<void>;
  updateUser: (id: string, user: Partial<User>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;

  createProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  bulkImportProducts: (products: any[]) => Promise<{ imported: number; updated: number }>;

  createClient: (client: Omit<Client, 'id'>) => Promise<void>;
  updateClient: (id: string, client: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;

  createPaymentMethod: (pm: Omit<PaymentMethod, 'id'>) => Promise<void>;
  updatePaymentMethod: (id: string, pm: Partial<PaymentMethod>) => Promise<void>;

  createSale: (sale: any) => Promise<Sale>;
  updateSale: (id: string, sale: any) => Promise<void>;

  openCashSession: (initialCash: number) => Promise<void>;
  closeCashSession: (sessionId: string, realAmounts: Record<string, number>) => Promise<void>;

  updateConfig: (config: Partial<SystemConfig>) => Promise<void>;
  addAuditLog: (actionType: AuditLogAction, details: string) => Promise<void>;

  // Theme
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  isLoading: true,
  isConnected: false,
  connectionError: null,
  serverUrl: localStorage.getItem('tervo-server-url') || `http://${window.location.hostname}:3001`,

  data: {
    users: [],
    products: [],
    clients: [],
    paymentMethods: [],
    sales: [],
    cashSessions: [],
    auditLogs: [],
    config: DEFAULT_CONFIG,
    currentUser: null,
    currentSessionId: null,
  },

  currentUser: null,
  currentSessionId: null,
  terminalId: getTerminalId(),
  theme: (localStorage.getItem('tervo-theme') as 'light' | 'dark' | 'system') || 'system',

  initialize: async () => {
    const token = getAuthToken();
    if (!token) {
      set({ isLoading: false, isConnected: true });
      return;
    }

    try {
      // Verify existing token
      const userData = await authApi.me();
      const user: User = {
        id: userData.id,
        username: userData.username,
        name: userData.name,
        role: userData.role as any,
        active: true,
      };
      set({ currentUser: user, isConnected: true });

      // Load all data
      await get().loadAllData();
      set({ isLoading: false });
    } catch {
      // Token invalid, clear it
      setAuthToken(null);
      set({ isLoading: false, isConnected: true, currentUser: null });
    }
  },

  setServerUrl: (url: string) => {
    localStorage.setItem('tervo-server-url', url);
    set({ serverUrl: url });
  },

  login: async (username: string, password: string) => {
    try {
      const result = await authApi.login(username, password);
      setAuthToken(result.token);

      const user: User = {
        id: result.user.id,
        username: result.user.username,
        name: result.user.name,
        role: result.user.role,
        active: result.user.active,
      };

      set({ currentUser: user });

      // Load all data after login
      await get().loadAllData();
      return null;
    } catch (err: any) {
      return err.message || 'Error de conexión con el servidor.';
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Even if API call fails, logout locally
    }
    setAuthToken(null);
    set({
      currentUser: null,
      currentSessionId: null,
      data: {
        users: [],
        products: [],
        clients: [],
        paymentMethods: [],
        sales: [],
        cashSessions: [],
        auditLogs: [],
        config: DEFAULT_CONFIG,
        currentUser: null,
        currentSessionId: null,
      },
    });
  },

  loadAllData: async () => {
    try {
      const [users, products, clients, paymentMethods, sales, cashSessions, auditLogs, config, activeSession] = await Promise.all([
        usersApi.getAll(),
        productsApi.getAll(),
        clientsApi.getAll(),
        paymentMethodsApi.getAll(),
        salesApi.getAll(),
        cashSessionsApi.getAll(),
        auditLogsApi.getAll(),
        configApi.get(),
        cashSessionsApi.getActive(),
      ]);

      set({
        data: {
          users,
          products,
          clients,
          paymentMethods,
          sales,
          cashSessions,
          auditLogs,
          config: config || DEFAULT_CONFIG,
          currentUser: get().currentUser,
          currentSessionId: activeSession?.id || null,
        },
        currentSessionId: activeSession?.id || null,
        isConnected: true,
        connectionError: null,
      });
    } catch (err: any) {
      set({ connectionError: err.message || 'Error al cargar datos del servidor.' });
    }
  },

  refreshData: async () => {
    await get().loadAllData();
  },

  // ===== USERS =====
  createUser: async (user) => {
    await usersApi.create(user);
    const users = await usersApi.getAll();
    set(state => ({ data: { ...state.data, users } }));
  },

  updateUser: async (id, user) => {
    await usersApi.update(id, user);
    const users = await usersApi.getAll();
    set(state => ({ data: { ...state.data, users } }));
  },

  deleteUser: async (id) => {
    await usersApi.delete(id);
    const users = await usersApi.getAll();
    set(state => ({ data: { ...state.data, users } }));
  },

  // ===== PRODUCTS =====
  createProduct: async (product) => {
    await productsApi.create(product);
    const products = await productsApi.getAll();
    set(state => ({ data: { ...state.data, products } }));
  },

  updateProduct: async (id, product) => {
    await productsApi.update(id, product);
    const products = await productsApi.getAll();
    set(state => ({ data: { ...state.data, products } }));
  },

  deleteProduct: async (id) => {
    await productsApi.delete(id);
    const products = await productsApi.getAll();
    set(state => ({ data: { ...state.data, products } }));
  },

  bulkImportProducts: async (products) => {
    const result = await productsApi.bulkImport(products);
    const updatedProducts = await productsApi.getAll();
    set(state => ({ data: { ...state.data, products: updatedProducts } }));
    return result;
  },

  // ===== CLIENTS =====
  createClient: async (client) => {
    await clientsApi.create(client);
    const clients = await clientsApi.getAll();
    set(state => ({ data: { ...state.data, clients } }));
  },

  updateClient: async (id, client) => {
    await clientsApi.update(id, client);
    const clients = await clientsApi.getAll();
    set(state => ({ data: { ...state.data, clients } }));
  },

  deleteClient: async (id) => {
    await clientsApi.delete(id);
    const clients = await clientsApi.getAll();
    set(state => ({ data: { ...state.data, clients } }));
  },

  // ===== PAYMENT METHODS =====
  createPaymentMethod: async (pm) => {
    await paymentMethodsApi.create(pm);
    const paymentMethods = await paymentMethodsApi.getAll();
    set(state => ({ data: { ...state.data, paymentMethods } }));
  },

  updatePaymentMethod: async (id, pm) => {
    await paymentMethodsApi.update(id, pm);
    const paymentMethods = await paymentMethodsApi.getAll();
    set(state => ({ data: { ...state.data, paymentMethods } }));
  },

  // ===== SALES =====
  createSale: async (sale) => {
    const created = await salesApi.create(sale);
    const [sales, products, cashSessions] = await Promise.all([
      salesApi.getAll(),
      productsApi.getAll(),
      cashSessionsApi.getAll(),
    ]);
    set(state => ({ data: { ...state.data, sales, products, cashSessions } }));
    return created;
  },

  updateSale: async (id, sale) => {
    await salesApi.update(id, sale);
    const [sales, products, cashSessions] = await Promise.all([
      salesApi.getAll(),
      productsApi.getAll(),
      cashSessionsApi.getAll(),
    ]);
    set(state => ({ data: { ...state.data, sales, products, cashSessions } }));
  },

  // ===== CASH SESSIONS =====
  openCashSession: async (initialCash) => {
    const { data } = get();
    const pmIds = data.paymentMethods.map(pm => pm.id);
    const session = await cashSessionsApi.open(initialCash, pmIds);
    const cashSessions = await cashSessionsApi.getAll();
    set(state => ({
      currentSessionId: session.id,
      data: { ...state.data, cashSessions, currentSessionId: session.id },
    }));
  },

  closeCashSession: async (sessionId, realAmounts) => {
    await cashSessionsApi.close(sessionId, realAmounts);
    const cashSessions = await cashSessionsApi.getAll();
    set(state => ({
      currentSessionId: null,
      data: { ...state.data, cashSessions, currentSessionId: null },
    }));
  },

  // ===== CONFIG =====
  updateConfig: async (config) => {
    await configApi.update(config);
    const updatedConfig = await configApi.get();
    set(state => ({ data: { ...state.data, config: updatedConfig } }));
  },

  // ===== AUDIT =====
  addAuditLog: async (actionType, details) => {
    try {
      await auditLogsApi.create(actionType, details);
    } catch {
      // Non-critical, don't block the flow
    }
  },

  // ===== THEME =====
  setTheme: (theme: 'light' | 'dark' | 'system') => {
    localStorage.setItem('tervo-theme', theme);
    set({ theme });
    applyTheme(theme);
  },
}));

// Apply theme to HTML element
export function applyTheme(theme: 'light' | 'dark' | 'system') {
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}
