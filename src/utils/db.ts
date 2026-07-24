import { SystemState, AuditLog, AuditLogAction } from '../types';

// This file now only exports helper utilities.
// Persistence is handled by the Zustand store + FileSystemAdapter.
// We keep addAuditLog for backward compatibility with child components.

export function getInitialState(): SystemState {
  // This is now only used as a fallback. Real data comes from the filesystem.
  return {
    users: [],
    products: [],
    clients: [],
    paymentMethods: [],
    sales: [],
    cashSessions: [],
    auditLogs: [],
    config: {
      lowStockAlert: 5,
      storeName: 'Mi Tienda POS',
      storeInfo: '',
    },
    currentUser: null,
    currentSessionId: null,
  };
}

export function saveState(_state: SystemState): void {
  // No-op: persistence is now handled by the store via FileSystemAdapter
}

export function addAuditLog(
  state: SystemState,
  actionType: AuditLogAction,
  details: string
): SystemState {
  const user = state.currentUser || { id: 'u_unknown', username: 'sistema', name: 'Sistema', role: 'vendedor' as const, active: true };
  const newLog: AuditLog = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    date: new Date().toISOString(),
    userId: user.id,
    username: user.username,
    actionType,
    details,
  };
  return {
    ...state,
    auditLogs: [newLog, ...state.auditLogs],
  };
}
