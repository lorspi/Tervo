const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;

let authToken: string | null = localStorage.getItem('tervo-auth-token');

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('tervo-auth-token', token);
  } else {
    localStorage.removeItem('tervo-auth-token');
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Token expired or invalid
    setAuthToken(null);
    window.location.reload();
    throw new Error('Sesión expirada');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Error de conexión con el servidor.' }));
    throw new Error(body.error || `Error ${response.status}`);
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) return {} as T;

  return response.json();
}

// Terminal ID management
export function getTerminalId(): string {
  let id = localStorage.getItem('tervo-terminal-id');
  if (!id) {
    id = 'terminal_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    localStorage.setItem('tervo-terminal-id', id);
  }
  return id;
}

export function setTerminalName(name: string) {
  localStorage.setItem('tervo-terminal-name', name);
}

export function getTerminalName(): string {
  return localStorage.getItem('tervo-terminal-name') || getTerminalId();
}

// ============ AUTH API ============

export const authApi = {
  login: (username: string, password: string) =>
    request<{ token: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, terminalId: getTerminalId() }),
    }),

  logout: () =>
    request<{ message: string }>('/api/auth/logout', { method: 'POST' }),

  heartbeat: () =>
    request<{ ok: boolean }>('/api/auth/heartbeat', { method: 'POST' }),

  me: () =>
    request<{ id: string; username: string; name: string; role: string; terminalId: string }>('/api/auth/me'),

  getActiveSessions: () =>
    request<Array<{ userId: string; terminalId: string; loginTime: string }>>('/api/auth/sessions'),
};

// ============ USERS API ============

export const usersApi = {
  getAll: () => request<any[]>('/api/users'),

  create: (data: any) =>
    request<any>('/api/users', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: any) =>
    request<any>(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) =>
    request<any>(`/api/users/${id}`, { method: 'DELETE' }),
};

// ============ PRODUCTS API ============

export const productsApi = {
  getAll: () => request<any[]>('/api/products'),

  create: (data: any) =>
    request<any>('/api/products', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: any) =>
    request<any>(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) =>
    request<any>(`/api/products/${id}`, { method: 'DELETE' }),

  bulkImport: (products: any[]) =>
    request<{ imported: number; updated: number }>('/api/products/bulk', {
      method: 'POST',
      body: JSON.stringify({ products }),
    }),
};

// ============ CLIENTS API ============

export const clientsApi = {
  getAll: () => request<any[]>('/api/clients'),

  create: (data: any) =>
    request<any>('/api/clients', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: any) =>
    request<any>(`/api/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) =>
    request<any>(`/api/clients/${id}`, { method: 'DELETE' }),
};

// ============ PAYMENT METHODS API ============

export const paymentMethodsApi = {
  getAll: () => request<any[]>('/api/payment-methods'),

  create: (data: any) =>
    request<any>('/api/payment-methods', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: any) =>
    request<any>(`/api/payment-methods/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) =>
    request<any>(`/api/payment-methods/${id}`, { method: 'DELETE' }),
};

// ============ SALES API ============

export const salesApi = {
  getAll: (sessionId?: string) =>
    request<any[]>(`/api/sales${sessionId ? `?sessionId=${sessionId}` : ''}`),

  create: (data: any) =>
    request<any>('/api/sales', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: any) =>
    request<any>(`/api/sales/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// ============ CASH SESSIONS API ============

export const cashSessionsApi = {
  getAll: (terminalId?: string) =>
    request<any[]>(`/api/cash-sessions${terminalId ? `?terminalId=${terminalId}` : ''}`),

  getActive: () =>
    request<any | null>('/api/cash-sessions/active'),

  open: (initialCash: number, paymentMethodIds: string[]) =>
    request<any>('/api/cash-sessions/open', {
      method: 'POST',
      body: JSON.stringify({ initialCash, paymentMethodIds }),
    }),

  close: (sessionId: string, realAmounts: Record<string, number>) =>
    request<any>(`/api/cash-sessions/${sessionId}/close`, {
      method: 'POST',
      body: JSON.stringify({ realAmounts }),
    }),
};

// ============ CONFIG API ============

export const configApi = {
  get: () => request<{ storeName: string; storeInfo: string; lowStockAlert: number }>('/api/config'),

  update: (data: any) =>
    request<any>('/api/config', { method: 'PUT', body: JSON.stringify(data) }),
};

// ============ AUDIT LOGS API ============

export const auditLogsApi = {
  getAll: (limit?: number) =>
    request<any[]>(`/api/audit-logs${limit ? `?limit=${limit}` : ''}`),

  create: (actionType: string, details: string) =>
    request<any>('/api/audit-logs', {
      method: 'POST',
      body: JSON.stringify({ actionType, details }),
    }),
};
