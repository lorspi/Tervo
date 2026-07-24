import { create } from 'zustand';
import { FileSystemAdapter, saveDirectoryHandle, loadDirectoryHandle, clearDirectoryHandle } from './utils/fs-adapter';
import { SystemState, User, Product, Client, PaymentMethod, Sale, CashSession, AuditLog, SystemConfig, AuditLogAction } from './types';

// Default data for new projects
const DEFAULT_USERS: User[] = [
  { id: 'u1', username: 'superadmin', name: 'Super Administrador', role: 'super-admin', password: '123', active: true },
  { id: 'u2', username: 'admin', name: 'Administrador', role: 'admin', password: '123', active: true },
  { id: 'u3', username: 'vendedor', name: 'Vendedor', role: 'vendedor', password: '123', active: true },
];

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'pm1', name: 'Efectivo', commissionPercent: 0, flatFee: 0, active: true },
  { id: 'pm2', name: 'Tarjeta', commissionPercent: 2.5, flatFee: 50, active: true },
  { id: 'pm3', name: 'Transferencia', commissionPercent: 0, flatFee: 0, active: true },
];

const DEFAULT_CONFIG: SystemConfig = {
  lowStockAlert: 5,
  storeName: 'Mi Tienda POS',
  storeInfo: 'Dirección de tu tienda\nTeléfono: +56 9 0000 0000\nBoleta de Venta',
  systemEnabled: true,
};

export interface AppStore {
  // File system
  adapter: FileSystemAdapter | null;
  isLoading: boolean;
  folderName: string | null;

  // App data (SystemState)
  data: SystemState;

  // UI
  currentUser: User | null;
  currentSessionId: string | null;
  theme: 'light' | 'dark' | 'system';

  // Actions
  initialize: () => Promise<void>;
  selectFolder: () => Promise<void>;
  closeProject: () => void;

  // Auth
  login: (username: string, password: string) => string | null;
  logout: () => void;

  // Data CRUD
  updateData: (newData: SystemState) => Promise<void>;
  addAuditLog: (actionType: AuditLogAction, details: string) => Promise<void>;
  backgroundReload: () => Promise<void>;

  // Theme
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  adapter: null,
  isLoading: true,
  folderName: null,

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
  theme: (localStorage.getItem('kora-theme') as 'light' | 'dark' | 'system') || 'system',

  initialize: async () => {
    try {
      const savedHandle = await loadDirectoryHandle();
      if (savedHandle) {
        const perm = await savedHandle.requestPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
          const adapter = new FileSystemAdapter(savedHandle);
          const configExists = await adapter.fileExists('/config.json');
          if (configExists) {
            const rawConfig = await adapter.readTextFile('/config.json');
            const config = JSON.parse(rawConfig);
            // Load all data
            const data = await loadAllData(adapter);
            // Restore user session from localStorage
            const savedUserId = localStorage.getItem('kora-pos-session-user');
            const restoredUser = savedUserId ? data.users.find(u => u.id === savedUserId && u.active) || null : null;
            set({
              adapter,
              isLoading: false,
              folderName: config.storeName || savedHandle.name,
              data,
              currentSessionId: data.currentSessionId,
              currentUser: restoredUser,
            });
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Could not restore previous session:', e);
    }
    set({ isLoading: false });
  },

  selectFolder: async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      const adapter = new FileSystemAdapter(handle);
      await saveDirectoryHandle(handle);

      const configExists = await adapter.fileExists('/config.json');
      if (configExists) {
        // Existing project - load data
        const rawConfig = await adapter.readTextFile('/config.json');
        const config = JSON.parse(rawConfig);
        const data = await loadAllData(adapter);
        // Restore user session from localStorage
        const savedUserId = localStorage.getItem('kora-pos-session-user');
        const restoredUser = savedUserId ? data.users.find(u => u.id === savedUserId && u.active) || null : null;
        set({
          adapter,
          isLoading: false,
          folderName: config.storeName || handle.name,
          data,
          currentSessionId: data.currentSessionId,
          currentUser: restoredUser,
        });
      } else {
        // New project - initialize structure
        await initializeProjectStructure(adapter);
        const data = await loadAllData(adapter);
        set({
          adapter,
          isLoading: false,
          folderName: data.config.storeName || handle.name,
          data,
          currentSessionId: null,
        });
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('Error selecting folder:', e);
      }
    }
  },

  closeProject: () => {
    clearDirectoryHandle();
    localStorage.removeItem('kora-pos-session-user');
    set({
      adapter: null,
      folderName: null,
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

  login: (username: string, password: string) => {
    const { data } = get();
    const foundUser = data.users.find(
      u => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
    );
    if (!foundUser) return 'Usuario o contraseña incorrectos.';
    if (!foundUser.active) return 'Esta cuenta ha sido desactivada.';
    set({ currentUser: foundUser });
    localStorage.setItem('kora-pos-session-user', foundUser.id);
    return null;
  },

  logout: () => {
    set({ currentUser: null });
    localStorage.removeItem('kora-pos-session-user');
  },

  updateData: async (newData: SystemState) => {
    const { adapter } = get();
    if (!adapter) return;
    set({ data: newData, currentSessionId: newData.currentSessionId });
    await saveAllData(adapter, newData);
  },

  addAuditLog: async (actionType: AuditLogAction, details: string) => {
    const { data, currentUser, adapter } = get();
    if (!adapter) return;
    const user = currentUser || { id: 'u_system', username: 'sistema', name: 'Sistema', role: 'vendedor' as const, active: true };
    const newLog: AuditLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      date: new Date().toISOString(),
      userId: user.id,
      username: user.username,
      actionType,
      details,
    };
    const updatedData = { ...data, auditLogs: [newLog, ...data.auditLogs] };
    set({ data: updatedData });
    await saveAllData(adapter, updatedData);
  },

  backgroundReload: async () => {
    const { adapter } = get();
    if (!adapter) return;
    try {
      const data = await loadAllData(adapter);
      set({ data, currentSessionId: data.currentSessionId });
    } catch (e) {
      console.warn('Background reload failed:', e);
    }
  },

  setTheme: (theme: 'light' | 'dark' | 'system') => {
    localStorage.setItem('kora-theme', theme);
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

// File structure:
// /config.json - store config + session state
// /users.json - users array
// /products.json - products array
// /clients.json - clients array
// /payment-methods.json - payment methods array
// /sales/sales.json - sales array
// /sessions/sessions.json - cash sessions array
// /logs/logs.json - audit logs array

async function initializeProjectStructure(adapter: FileSystemAdapter): Promise<void> {
  const config: SystemConfig & { currentSessionId: string | null } = {
    ...DEFAULT_CONFIG,
    currentSessionId: null,
  };

  await adapter.ensureDirectory('sales');
  await adapter.ensureDirectory('sessions');
  await adapter.ensureDirectory('logs');

  await adapter.writeTextFile('/config.json', JSON.stringify(config, null, 2));
  await adapter.writeTextFile('/users.json', JSON.stringify(DEFAULT_USERS, null, 2));
  await adapter.writeTextFile('/products.json', JSON.stringify([], null, 2));
  await adapter.writeTextFile('/clients.json', JSON.stringify([
    { id: 'c_generic', name: 'Cliente General', document: '', phone: '', email: '', address: '' }
  ], null, 2));
  await adapter.writeTextFile('/payment-methods.json', JSON.stringify(DEFAULT_PAYMENT_METHODS, null, 2));
  await adapter.writeTextFile('/sales/sales.json', JSON.stringify([], null, 2));
  await adapter.writeTextFile('/sessions/sessions.json', JSON.stringify([], null, 2));
  await adapter.writeTextFile('/logs/logs.json', JSON.stringify([], null, 2));
}

async function loadAllData(adapter: FileSystemAdapter): Promise<SystemState> {
  const readJSON = async <T>(path: string, fallback: T): Promise<T> => {
    try {
      const raw = await adapter.readTextFile(path);
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  const config = await readJSON<SystemConfig & { currentSessionId?: string | null }>('/config.json', { ...DEFAULT_CONFIG, currentSessionId: null });
  const users = await readJSON<User[]>('/users.json', DEFAULT_USERS);
  const products = await readJSON<Product[]>('/products.json', []);
  const clients = await readJSON<Client[]>('/clients.json', []);
  const paymentMethods = await readJSON<PaymentMethod[]>('/payment-methods.json', DEFAULT_PAYMENT_METHODS);
  const sales = await readJSON<Sale[]>('/sales/sales.json', []);
  const cashSessions = await readJSON<CashSession[]>('/sessions/sessions.json', []);
  const auditLogs = await readJSON<AuditLog[]>('/logs/logs.json', []);

  const { currentSessionId, ...sysConfig } = config;

  return {
    users,
    products,
    clients,
    paymentMethods,
    sales,
    cashSessions,
    auditLogs,
    config: sysConfig,
    currentUser: null,
    currentSessionId: currentSessionId || null,
  };
}

async function saveAllData(adapter: FileSystemAdapter, data: SystemState): Promise<void> {
  try {
    const configToSave = { ...data.config, currentSessionId: data.currentSessionId };
    await adapter.writeTextFile('/config.json', JSON.stringify(configToSave, null, 2));
    await adapter.writeTextFile('/users.json', JSON.stringify(data.users, null, 2));
    await adapter.writeTextFile('/products.json', JSON.stringify(data.products, null, 2));
    await adapter.writeTextFile('/clients.json', JSON.stringify(data.clients, null, 2));
    await adapter.writeTextFile('/payment-methods.json', JSON.stringify(data.paymentMethods, null, 2));
    await adapter.writeTextFile('/sales/sales.json', JSON.stringify(data.sales, null, 2));
    await adapter.writeTextFile('/sessions/sessions.json', JSON.stringify(data.cashSessions, null, 2));
    await adapter.writeTextFile('/logs/logs.json', JSON.stringify(data.auditLogs, null, 2));
  } catch (e) {
    console.error('Error saving data to filesystem:', e);
  }
}
