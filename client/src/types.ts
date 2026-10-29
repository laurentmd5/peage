export type UserRole = 'admin' | 'superviseur' | 'caissier' | 'operateur' | 'maintenance';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
}

export type PaymentMethod = 'ESPECES' | 'CARTE' | 'WAVE' | 'ORANGE_MONEY' | 'RFID';

export interface VehicleDetection {
  plateNumber: string;
  confidence: number;
  categoryCode: string;
  categoryLabel: string;
  amountDue: number;
  ticketNumber: string;
  qrCodeData: string;
  detectedAt: string;
  vehicleImageUrl: string;
}

export interface TollTransaction {
  id: string;
  ticketNumber: string;
  laneId: string;
  plateNumber: string;
  categoryCode: string;
  categoryLabel: string;
  amountDue: number;
  amountPaid: number;
  changeReturned: number;
  paymentMethod: PaymentMethod;
  cashierId: string;
  cashierName: string;
  status: 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  cancelledAt?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  qrCodeData?: string;
}

export interface TariffCategory {
  code: string;
  label: string;
  currentRate: number;
  isActive: boolean;
  history: Array<{
    rate: number;
    effectiveDate: string;
    changedBy: string;
    reason?: string;
  }>;
}

export interface CashSession {
  id: string;
  cashierId: string;
  cashierName: string;
  boothId: string;
  openedAt: string;
  closedAt?: string;
  initialFloat: number;
  totalCollected: number;
  expectedCashInDrawer: number;
  realCashCounted?: number;
  discrepancy?: number;
  status: 'OPEN' | 'CLOSED';
  breakdown: Record<PaymentMethod, { count: number; total: number }>;
}

export interface DashboardStats {
  todayVehiclesCount: number;
  todayRevenue: number;
  todayCancelledCount: number;
  todayManualOpeningsCount: number;
  activeSessionsCount: number;
  revenueByHour: Array<{ hour: string; revenue: number; count: number }>;
  categoryDistribution: Array<{ code: string; label: string; count: number; percentage: number }>;
  paymentDistribution: Array<{ method: PaymentMethod; label: string; count: number; total: number }>;
  laneDistribution: Array<{ laneId: string; count: number; total: number }>;
  cashierRanking: Array<{ cashierName: string; count: number; total: number }>;
  recentTransactions: TollTransaction[];
  equipmentHealth: {
    barrier: 'OK' | 'WARN' | 'ERROR';
    anprCamera: 'OK' | 'WARN' | 'ERROR';
    loopDetector: 'OK' | 'WARN' | 'ERROR';
    receiptPrinter: 'OK' | 'WARN' | 'ERROR';
    paymentTerminal: 'OK' | 'WARN' | 'ERROR';
    displayPanel: 'OK' | 'WARN' | 'ERROR';
  };
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  eventType: string;
  userId: string;
  username: string;
  details: Record<string, any>;
  ipAddress?: string;
}
