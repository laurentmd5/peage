import {
  User,
  VehicleDetection,
  TollTransaction,
  TariffCategory,
  CashSession,
  DashboardStats,
  AuditEvent,
  PaymentMethod
} from '../types.ts';

const API_BASE = '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('peage_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errMessage = 'Une erreur est survenue';
    try {
      const err = await response.json();
      errMessage = err.error || err.message || errMessage;
    } catch (_) {}
    throw new Error(errMessage);
  }

  return response.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),

  logout: () =>
    request<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  getMe: () => request<{ user: User }>('/auth/me'),

  getUsers: () => request<User[]>('/auth/users'),

  // Toll
  detectVehicle: (laneId: string = 'CAISSE-01', plate?: string, category?: string, vehicleImageUrl?: string) =>
    request<VehicleDetection>('/toll/detect', {
      method: 'POST',
      body: JSON.stringify({ laneId, plate, category, vehicleImageUrl })
    }),

  processPayment: (payload: {
    sessionId?: string;
    laneId: string;
    plateNumber: string;
    categoryCode: string;
    categoryLabel: string;
    amountDue: number;
    amountPaid: number;
    paymentMethod: PaymentMethod;
    cashierId: string;
    cashierName: string;
    ticketNumber: string;
    qrCodeData?: string;
  }) =>
    request<TollTransaction>('/toll/pay', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  getTransactions: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ transactions: TollTransaction[]; total: number }>(`/toll/transactions?${qs}`);
  },

  getTransaction: (id: string) => request<TollTransaction>(`/toll/transactions/${id}`),

  cancelTransaction: (id: string, reason: string) =>
    request<TollTransaction>(`/toll/transactions/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),

  openBarrierManually: (laneId: string, reason: string) =>
    request<{ success: boolean; message: string; openedAt: string }>('/toll/barrier/open-manual', {
      method: 'POST',
      body: JSON.stringify({ laneId, reason })
    }),

  // Caisse
  openCaisse: (boothId: string, initialFloat: number) =>
    request<CashSession>('/caisse/open', {
      method: 'POST',
      body: JSON.stringify({ boothId, initialFloat })
    }),

  getActiveCaisse: () => request<CashSession | null>('/caisse/active'),

  closeCaisse: (sessionId: string, realCashCounted: number) =>
    request<CashSession>('/caisse/close', {
      method: 'POST',
      body: JSON.stringify({ sessionId, realCashCounted })
    }),

  // Tariffs
  getTariffs: () => request<TariffCategory[]>('/tariffs'),

  updateTariffRate: (code: string, newRate: number, reason?: string) =>
    request<TariffCategory>(`/tariffs/${code}/rate`, {
      method: 'PUT',
      body: JSON.stringify({ newRate, reason })
    }),

  createTariff: (code: string, label: string, rate: number) =>
    request<TariffCategory>('/tariffs', {
      method: 'POST',
      body: JSON.stringify({ code, label, rate })
    }),

  toggleTariffActive: (code: string) =>
    request<TariffCategory>(`/tariffs/${code}/toggle`, { method: 'PUT' }),

  // Dashboard
  getDashboardStats: () => request<DashboardStats>('/dashboard/stats'),

  // Reports
  getReportsSummary: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<any>(`/reports/summary?${qs}`);
  },

  // Audit
  getAuditLogs: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<AuditEvent[]>(`/audit/logs?${qs}`);
  },

  // Caméra Réelle LAPI / ANPR (Multi-Marques: Hikvision, Dahua, Axis, ONVIF...)
  getCameraStatus: () =>
    request<{
      status: string;
      supportedVendors?: string[];
      supportedModel?: string;
      serverIps?: string[];
      primaryServerIp?: string;
      serverPort?: number;
      webhookUrls?: string[];
      webhookEndpoint: string;
      activeCameraIp?: string | null;
      activeDetectionsCount: number;
    }>('/toll/camera-status'),

  getNetworkInfo: () =>
    request<{
      serverIps: string[];
      primaryIp: string;
      port: number;
      webhookUrls: string[];
    }>('/toll/network-info'),

  getLatestCameraDetection: (laneId: string = 'VOIE-01') =>
    request<{ laneId: string; detection: VehicleDetection | null }>(`/toll/camera-latest?laneId=${encodeURIComponent(laneId)}`),

  simulateCameraWebhook: (payload?: {
    plateNumber?: string;
    vehicleType?: string;
    confidence?: number;
    laneId?: string;
    vehicleImageUrl?: string;
  }) =>
    request<{ ResponseStatus: string; message: string; detection: VehicleDetection }>('/toll/camera-webhook/simulate', {
      method: 'POST',
      body: JSON.stringify(payload || {})
    }),

  // Aliases de compatibilité Hikvision Smart IPC
  getHikvisionStatus: () =>
    request<{
      status: string;
      supportedModel: string;
      defaultCameraIp: string;
      webhookEndpoint: string;
      activeDetectionsCount: number;
    }>('/toll/hikvision-status'),

  getLatestHikvisionDetection: (laneId: string = 'VOIE-01') =>
    request<{ laneId: string; detection: VehicleDetection | null }>(`/toll/hikvision-latest?laneId=${encodeURIComponent(laneId)}`),

  simulateHikvisionWebhook: (payload?: {
    plateNumber?: string;
    vehicleType?: string;
    confidence?: number;
    laneId?: string;
    vehicleImageUrl?: string;
  }) =>
    request<{ ResponseStatus: string; message: string; detection: VehicleDetection }>('/toll/hikvision-webhook/simulate', {
      method: 'POST',
      body: JSON.stringify(payload || {})
    })
};
