export type UserRole = 'super-admin' | 'admin' | 'vendedor';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  password?: string; // in a real app this is hashed, here we keep it simple for the demo login
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  barcode: string;
  category: string;
  stock: number;
  cost: number;
  price: number;
}

export interface Client {
  id: string;
  name: string;
  document?: string; // DNI, RUT, RFC, etc.
  phone?: string;
  email?: string;
  address?: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  commissionPercent: number; // percentage, e.g. 1.5% as 1.5
  flatFee: number; // fixed cost, e.g. $100
  active: boolean;
}

export interface SaleItem {
  productId: string;
  name: string;
  price: number; // price sold at
  cost: number; // cost at the time of sale
  quantity: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  code: string; // e.g. V-0001
  date: string; // ISO String
  clientId?: string;
  clientName?: string;
  items: SaleItem[];
  subtotal: number; // items price * qty
  totalCommissions: number;
  totalFees: number;
  totalPayable: number; // subtotal + commissions + fees
  payments: {
    methodId: string;
    methodName: string;
    amount: number;
  }[];
  cashierId: string;
  cashierName: string;
  cashSessionId: string; // link to the cash session this sale occurred in
}

export interface CashSession {
  id: string;
  openDate: string; // ISO String
  closeDate?: string; // ISO String
  openedBy: string; // userId
  openedByName: string; // user name
  closedBy?: string; // userId
  closedByName?: string; // user name
  initialCash: number;
  expectedAmounts: Record<string, number>; // methodId -> amount expected
  realAmounts?: Record<string, number>; // methodId -> amount reported
  discrepancies?: Record<string, number>; // methodId -> difference
  status: 'open' | 'closed';
}

export type AuditLogAction = 'inventory' | 'payment_method' | 'config' | 'user' | 'client' | 'system_status';

export interface AuditLog {
  id: string;
  date: string; // ISO String
  userId: string;
  username: string;
  actionType: AuditLogAction;
  details: string;
}

export interface SystemConfig {
  lowStockAlert: number;
  storeName: string;
  storeInfo: string;
  systemEnabled: boolean;
}

export interface SystemState {
  users: User[];
  products: Product[];
  clients: Client[];
  paymentMethods: PaymentMethod[];
  sales: Sale[];
  cashSessions: CashSession[];
  auditLogs: AuditLog[];
  config: SystemConfig;
  currentUser: User | null;
  currentSessionId: string | null; // active session ID
}
