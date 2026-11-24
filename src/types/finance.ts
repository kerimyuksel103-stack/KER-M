export type TransactionType = 'income' | 'expense';

export type Branch = 'Gebze' | 'Yenidoğan';

export const BRANCHES: Branch[] = ['Gebze', 'Yenidoğan'];

export type PaymentMethod = 'Banka Havalesi' | 'Kredi Kartı' | 'Nakit' | 'Otomatik Ödeme';

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  branch: Branch;
  type: TransactionType;
  category: string;
  description: string;
  amount: number; // Always positive number in TRY
  vehiclePlate?: string; // Optional license plate for vehicle expenses
  paymentMethod?: PaymentMethod; // Legacy optional field
  customerName?: string;
  customerPhone?: string;
  warrantyPeriod?: string;
  documentNo?: string;
}

export type AppView =
  | 'ledger'
  | 'customers-report'
  | 'vehicle-report'
  | 'monthly-report'
  | 'annual-matrix';

export interface CategoryBreakdownItem {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

export interface BranchPnLItem {
  branch: Branch;
  income: number;
  expense: number;
  net: number;
  margin: number | null;
  transactionCount: number;
  incomeShare: number;
}

export interface MonthlyPnLSummary {
  monthKey: string; // YYYY-MM
  label: string;
  income: number;
  expense: number;
  net: number;
  margin: number | null; // null if income is 0
  transactionCount: number;
  incomeCount: number;
  expenseCount: number;
  incomeCategories: CategoryBreakdownItem[];
  expenseCategories: CategoryBreakdownItem[];
}

export interface VehiclePlateSummary {
  plate: string;
  total: number;
  count: number;
  share: number;
  subtypes: CategoryBreakdownItem[];
}

export const VEHICLE_PLATES = ['06 GE 3789', '34 NOZ 300'] as const;

export const DEFAULT_INCOME_CATEGORIES = [
  'TV Tamiri',
  'Uydu Montaj / Servis',
  'Kamera / Güvenlik Sistemi',
  'Tv Satış',
  'Malzeme / Parça Satışı',
  'Diğer Gelir',
  'Servis',
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Malzeme / Parça Alımı',
  'Kira Gideri',
  'Personel / Maaş',
  'Yakıt / Ulaşım',
  'Bakım / Onarım',
  'Sigorta / Muayene / Vergi',
  'HGS / Otopark',
  'Elektrik Gideri',
  'Vergi / SGK',
  'Yemek Gideri',
  'Hgs Gideri',
  'Su Gideri',
  'İnternet Gideri',
  'Telefon Gideri',
  'Diğer Gider',
];

export const PAYMENT_METHODS: PaymentMethod[] = [
  'Banka Havalesi',
  'Kredi Kartı',
  'Nakit',
  'Otomatik Ödeme',
];
