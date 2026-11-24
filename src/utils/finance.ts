import {
  BRANCHES,
  Branch,
  BranchPnLItem,
  CategoryBreakdownItem,
  MonthlyPnLSummary,
  Transaction,
  VEHICLE_PLATES,
  VehiclePlateSummary,
} from '../types/finance';

export const TURKISH_MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

export function formatTRY(amount: number, showPlusSign = false): string {
  const absFormatted = new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  if (amount < 0) {
    return `-₺${absFormatted}`;
  }
  if (showPlusSign && amount > 0) {
    return `+₺${absFormatted}`;
  }
  return `₺${absFormatted}`;
}

export function formatCompactTRY(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}₺${(abs / 1_000_000).toFixed(1).replace('.', ',')}M`;
  }
  if (abs >= 1_000) {
    return `${sign}₺${(abs / 1_000).toFixed(0)}B`;
  }
  return `${sign}₺${abs.toFixed(0)}`;
}

export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '—';
  }
  return `%${value.toFixed(1).replace('.', ',')}`;
}

export function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

export function formatMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const monthIdx = Number(monthStr) - 1;
  if (Number.isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) {
    return monthKey;
  }
  return `${TURKISH_MONTHS[monthIdx]} ${yearStr}`;
}

export function formatDateTR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}.${m}.${y}`;
}

export function toTelHref(phone: string): string {
  const cleaned = phone.trim().replace(/[^\d+]/g, '');
  return `tel:${cleaned}`;
}

export type WarrantyStatus = 'active' | 'expiring' | 'expired' | 'lifetime' | 'none' | 'unknown';

export interface RemainingWarrantyInfo {
  status: WarrantyStatus;
  label: string;
  endDateStr: string | null;
}

export function calculateRemainingWarranty(
  startDateStr: string,
  warrantyPeriod?: string,
  referenceDate: Date = new Date()
): RemainingWarrantyInfo {
  const raw = warrantyPeriod?.trim();
  if (!raw) {
    return { status: 'none', label: '—', endDateStr: null };
  }

  const normalized = raw.toLocaleLowerCase('tr-TR');
  if (normalized === 'garanti yok' || normalized === 'yok' || normalized === '-') {
    return { status: 'none', label: 'Garanti Yok', endDateStr: null };
  }
  if (normalized.includes('ömür') || normalized.includes('omur') || normalized.includes('süresiz')) {
    return { status: 'lifetime', label: 'Süresiz', endDateStr: null };
  }

  const [yStr, mStr, dStr] = startDateStr.split('-');
  const startY = Number(yStr);
  const startM = Number(mStr);
  const startD = Number(dStr);
  if (!startY || !startM || !startD) {
    return { status: 'unknown', label: 'Belirsiz', endDateStr: null };
  }

  const match = normalized.match(/^(\d+)\s*(ay|yıl|yil|gün|gun|hafta)?/i);
  if (!match) {
    return { status: 'unknown', label: 'Belirsiz', endDateStr: null };
  }

  const qty = Number(match[1]);
  if (!Number.isFinite(qty) || qty <= 0) {
    return { status: 'none', label: 'Garanti Yok', endDateStr: null };
  }

  const unit = match[2] ?? 'ay';
  let endDate: Date;

  if (unit.startsWith('y')) {
    const targetMonthIndex = startM - 1 + qty * 12;
    const targetYear = startY + Math.floor(targetMonthIndex / 12);
    const targetMonth = targetMonthIndex % 12;
    const maxDay = new Date(targetYear, targetMonth + 1, 0).getDate();
    endDate = new Date(targetYear, targetMonth, Math.min(startD, maxDay));
  } else if (unit.startsWith('g')) {
    endDate = new Date(startY, startM - 1, startD + qty);
  } else if (unit.startsWith('h')) {
    endDate = new Date(startY, startM - 1, startD + qty * 7);
  } else {
    const targetMonthIndex = startM - 1 + qty;
    const targetYear = startY + Math.floor(targetMonthIndex / 12);
    const targetMonth = targetMonthIndex % 12;
    const maxDay = new Date(targetYear, targetMonth + 1, 0).getDate();
    endDate = new Date(targetYear, targetMonth, Math.min(startD, maxDay));
  }

  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );

  const endDateStr = `${String(endDate.getDate()).padStart(2, '0')}.${String(
    endDate.getMonth() + 1
  ).padStart(2, '0')}.${endDate.getFullYear()}`;

  if (today.getTime() > endDate.getTime()) {
    return { status: 'expired', label: 'Süresi Doldu', endDateStr };
  }

  if (today.getTime() === endDate.getTime()) {
    return { status: 'expiring', label: 'Bugün Son Gün', endDateStr };
  }

  // Calendar-accurate months + days difference
  let months =
    (endDate.getFullYear() - today.getFullYear()) * 12 +
    (endDate.getMonth() - today.getMonth());
  let days = endDate.getDate() - today.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthMaxDay = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      0
    ).getDate();
    days = prevMonthMaxDay - today.getDate() + endDate.getDate();
  }

  const totalDaysApprox = Math.round(
    (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  const parts: string[] = [];
  if (months > 0) parts.push(`${months} Ay`);
  if (days > 0) parts.push(`${days} Gün`);
  const label = parts.length > 0 ? parts.join(' ') : 'Bugün Son Gün';

  return {
    status: totalDaysApprox <= 30 ? 'expiring' : 'active',
    label,
    endDateStr,
  };
}

export function getPreviousMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  let year = Number(yearStr);
  let month = Number(monthStr) - 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function getNextMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  let year = Number(yearStr);
  let month = Number(monthStr) + 1;
  if (month === 13) {
    month = 1;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function getAvailableMonths(transactions: Transaction[], fallbackMonth: string): string[] {
  const set = new Set<string>([fallbackMonth]);
  for (const tx of transactions) {
    if (tx.date && tx.date.length >= 7) {
      set.add(getMonthKey(tx.date));
    }
  }
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

export function getAvailableYears(transactions: Transaction[], fallbackYear: number): number[] {
  const set = new Set<number>([fallbackYear]);
  for (const tx of transactions) {
    const year = Number(tx.date.slice(0, 4));
    if (!Number.isNaN(year) && year > 1990) {
      set.add(year);
    }
  }
  return Array.from(set).sort((a, b) => b - a);
}

function buildCategoryBreakdown(
  items: Transaction[],
  total: number
): CategoryBreakdownItem[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const tx of items) {
    const current = map.get(tx.category) ?? { total: 0, count: 0 };
    current.total += tx.amount;
    current.count += 1;
    map.set(tx.category, current);
  }
  return Array.from(map.entries())
    .map(([category, data]) => ({
      category,
      total: data.total,
      count: data.count,
      percentage: total > 0 ? (data.total / total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export function calculateMonthlyPnL(
  transactions: Transaction[],
  monthKey: string,
  branchFilter: 'all' | Branch = 'all'
): MonthlyPnLSummary {
  const monthTxs = transactions.filter(
    (tx) =>
      getMonthKey(tx.date) === monthKey &&
      (branchFilter === 'all' || tx.branch === branchFilter)
  );
  const incomeTxs = monthTxs.filter((tx) => tx.type === 'income');
  const expenseTxs = monthTxs.filter((tx) => tx.type === 'expense');

  const income = incomeTxs.reduce((sum, tx) => sum + tx.amount, 0);
  const expense = expenseTxs.reduce((sum, tx) => sum + tx.amount, 0);
  const net = income - expense;
  const margin = income > 0 ? (net / income) * 100 : null;

  return {
    monthKey,
    label: formatMonthLabel(monthKey),
    income,
    expense,
    net,
    margin,
    transactionCount: monthTxs.length,
    incomeCount: incomeTxs.length,
    expenseCount: expenseTxs.length,
    incomeCategories: buildCategoryBreakdown(incomeTxs, income),
    expenseCategories: buildCategoryBreakdown(expenseTxs, expense),
  };
}

export function calculateBranchBreakdown(
  transactions: Transaction[],
  monthKey?: string
): BranchPnLItem[] {
  const scoped = monthKey
    ? transactions.filter((tx) => getMonthKey(tx.date) === monthKey)
    : transactions;

  const totalIncomeAll = scoped
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);

  return BRANCHES.map((branch) => {
    const branchTxs = scoped.filter((tx) => tx.branch === branch);
    const income = branchTxs
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const expense = branchTxs
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const net = income - expense;
    const margin = income > 0 ? (net / income) * 100 : null;

    return {
      branch,
      income,
      expense,
      net,
      margin,
      transactionCount: branchTxs.length,
      incomeShare: totalIncomeAll > 0 ? (income / totalIncomeAll) * 100 : 0,
    };
  });
}

export function getTrailingMonths(endMonthKey: string, count: number): string[] {
  const result: string[] = [];
  let cursor = endMonthKey;
  for (let i = 0; i < count; i += 1) {
    result.unshift(cursor);
    cursor = getPreviousMonthKey(cursor);
  }
  return result;
}

export function downloadTransactionsCSV(
  transactions: Transaction[],
  filename = 'gelir-gider-kayitlari.csv'
): void {
  const headers = [
    'Tarih',
    'Şube',
    'İşlem Türü',
    'Kategori',
    'Açıklama',
    'Plaka',
    'Müşteri / Firma Adı',
    'Telefon',
    'Garanti Süresi',
    'Tutar (TRY)',
  ];
  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;

  const rows = [...transactions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((tx) => {
      const signedAmount = tx.type === 'income' ? tx.amount : -tx.amount;
      const plateInfo = getTransactionVehicleInfo(tx);
      return [
        tx.date,
        tx.branch,
        tx.type === 'income' ? 'Gelir' : 'Gider',
        tx.category,
        tx.description,
        plateInfo?.plate ?? '',
        tx.customerName ?? '',
        tx.customerPhone ?? '',
        tx.warrantyPeriod ?? '',
        signedAmount.toFixed(2).replace('.', ','),
      ]
        .map((cell) => escape(String(cell)))
        .join(';');
    });

  const csvContent = '\uFEFF' + [headers.map(escape).join(';'), ...rows].join('\r\n');
  triggerCSVDownload(csvContent, filename);
}

export function downloadCustomerListCSV(
  transactions: Transaction[],
  filename = 'musteri-listesi.csv'
): void {
  const headers = [
    'Tarih',
    'Şube',
    'Müşteri / Firma Adı',
    'Telefon',
    'Garanti Süresi',
    'Kalan Garanti Süresi',
    'Garanti Bitiş Tarihi',
    'Kategori',
    'Açıklama',
    'Belge No',
    'Tutar (TRY)',
  ];
  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;

  const rows = [...transactions]
    .filter((tx) => tx.type === 'income')
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((tx) => {
      const remaining = calculateRemainingWarranty(tx.date, tx.warrantyPeriod);
      return [
        tx.date,
        tx.branch,
        tx.customerName ?? '',
        tx.customerPhone ?? '',
        tx.warrantyPeriod ?? '',
        remaining.label,
        remaining.endDateStr ?? '',
        tx.category,
        tx.description,
        tx.documentNo ?? '',
        tx.amount.toFixed(2).replace('.', ','),
      ]
        .map((cell) => escape(String(cell)))
        .join(';');
    });

  const csvContent = '\uFEFF' + [headers.map(escape).join(';'), ...rows].join('\r\n');
  triggerCSVDownload(csvContent, filename);
}

export function downloadMonthlyReportCSV(
  summary: MonthlyPnLSummary,
  branchScopeLabel = 'Tüm Şubeler (Konsolide)',
  branchBreakdown?: BranchPnLItem[]
): void {
  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const lines: string[] = [
    [escape('AYLIK KÂR / ZARAR RAPORU'), escape(summary.label), escape(branchScopeLabel)].join(';'),
    '',
    [escape('ÖZET GÖSTERGELER'), escape('Tutar / Değer')].join(';'),
    [escape('Toplam Gelir'), escape(summary.income.toFixed(2).replace('.', ','))].join(';'),
    [escape('Toplam Gider'), escape(summary.expense.toFixed(2).replace('.', ','))].join(';'),
    [escape('Net Kâr / Zarar'), escape(summary.net.toFixed(2).replace('.', ','))].join(';'),
    [escape('Net Kâr Marjı'), escape(formatPercent(summary.margin))].join(';'),
  ];

  if (branchBreakdown && branchBreakdown.length > 0) {
    lines.push(
      '',
      [
        escape('ŞUBE BAZLI ÖZET'),
        escape('Gelir (TRY)'),
        escape('Gider (TRY)'),
        escape('Net Kâr / Zarar (TRY)'),
        escape('Kâr Marjı'),
      ].join(';'),
      ...branchBreakdown.map((b) =>
        [
          escape(`${b.branch} Şubesi`),
          escape(b.income.toFixed(2).replace('.', ',')),
          escape(b.expense.toFixed(2).replace('.', ',')),
          escape(b.net.toFixed(2).replace('.', ',')),
          escape(formatPercent(b.margin)),
        ].join(';')
      )
    );
  }

  lines.push(
    '',
    [escape('GELİR KATEGORİLERİ'), escape('İşlem Adedi'), escape('Tutar (TRY)'), escape('Pay (%)')].join(';'),
    ...summary.incomeCategories.map((c) =>
      [
        escape(c.category),
        escape(String(c.count)),
        escape(c.total.toFixed(2).replace('.', ',')),
        escape(formatPercent(c.percentage)),
      ].join(';')
    ),
    '',
    [escape('GİDER KATEGORİLERİ'), escape('İşlem Adedi'), escape('Tutar (TRY)'), escape('Pay (%)')].join(';'),
    ...summary.expenseCategories.map((c) =>
      [
        escape(c.category),
        escape(String(c.count)),
        escape(c.total.toFixed(2).replace('.', ',')),
        escape(formatPercent(c.percentage)),
      ].join(';')
    )
  );

  const csvContent = '\uFEFF' + lines.join('\r\n');
  triggerCSVDownload(csvContent, `kar-zarar-raporu-${summary.monthKey}.csv`);
}

function triggerCSVDownload(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const TURKISH_PLATE_PREFIX_RE = /^\s*(\d{2}\s*[A-ZÇĞİÖŞÜ]{1,3}\s*\d{2,4})\s*[-–—:/]\s*(.+)$/i;
const TURKISH_PLATE_ANYWHERE_RE = /\b(\d{2}\s*[A-ZÇĞİÖŞÜ]{1,3}\s*\d{2,4})\b/i;

export function normalizePlate(raw: string): string {
  const compact = raw.trim().toUpperCase().replace(/\s+/g, '');
  const match = compact.match(/^(\d{2})([A-ZÇĞİÖŞÜ]{1,3})(\d{2,4})$/);
  if (match) {
    return `${match[1]} ${match[2]} ${match[3]}`;
  }
  return raw.trim().toUpperCase().replace(/\s+/g, ' ');
}

export function hasPlateInCategory(category: string): boolean {
  return TURKISH_PLATE_ANYWHERE_RE.test(category.trim());
}

function mapLegacyVehicleSubtype(rawSubtype: string): string {
  const cleaned = rawSubtype.replace(/^[-–—:/\s]+|[-–—:/\s]+$/g, '').trim();
  if (!cleaned) return 'Diğer Gider';
  const lower = cleaned.toLocaleLowerCase('tr-TR');
  if (lower === 'yakıt' || lower === 'yakit') return 'Yakıt / Ulaşım';
  if (lower.includes('bakım') || lower.includes('bakim') || lower.includes('onarım')) {
    return 'Bakım / Onarım';
  }
  if (lower.includes('sigorta') || lower.includes('muayene')) {
    return 'Sigorta / Muayene / Vergi';
  }
  if (lower === 'hgs' || lower.includes('hgs / otopark')) {
    return 'HGS / Otopark';
  }
  return cleaned;
}

export function extractPlateAndCleanCategory(
  category: string
): { plate: string; cleanCategory: string } | null {
  const trimmed = category.trim();
  const plateMatch = trimmed.match(TURKISH_PLATE_ANYWHERE_RE);
  if (!plateMatch) return null;

  const plate = normalizePlate(plateMatch[1]);
  const remainder = trimmed.replace(plateMatch[0], ' ').replace(/\s+/g, ' ').trim();
  return {
    plate,
    cleanCategory: mapLegacyVehicleSubtype(remainder),
  };
}

export function parseVehicleCategory(
  category: string
): { plate: string; expenseType: string } | null {
  const trimmed = category.trim();
  const match = trimmed.match(TURKISH_PLATE_PREFIX_RE);
  if (!match) return null;
  return {
    plate: normalizePlate(match[1]),
    expenseType: match[2].trim(),
  };
}

export function getTransactionVehicleInfo(
  tx: Transaction
): { plate: string; expenseType: string } | null {
  if (tx.type !== 'expense') return null;
  if (tx.vehiclePlate && tx.vehiclePlate.trim()) {
    return {
      plate: normalizePlate(tx.vehiclePlate),
      expenseType: tx.category.trim(),
    };
  }
  return parseVehicleCategory(tx.category);
}

export function getDetectedVehiclePlates(transactions: Transaction[]): string[] {
  const set = new Set<string>(VEHICLE_PLATES);
  for (const tx of transactions) {
    const info = getTransactionVehicleInfo(tx);
    if (info) {
      set.add(info.plate);
    }
  }
  return Array.from(set);
}

export function calculateVehicleSummaries(
  transactions: Transaction[],
  plates: string[]
): VehiclePlateSummary[] {
  const vehicleExpenses = transactions.filter(
    (tx) => getTransactionVehicleInfo(tx) !== null
  );
  const grandTotal = vehicleExpenses.reduce((s, tx) => s + tx.amount, 0);

  return plates.map((plate) => {
    const plateTxs = vehicleExpenses.filter(
      (tx) => getTransactionVehicleInfo(tx)?.plate === plate
    );
    const total = plateTxs.reduce((s, tx) => s + tx.amount, 0);
    const subtypeMap = new Map<string, { total: number; count: number }>();

    for (const tx of plateTxs) {
      const info = getTransactionVehicleInfo(tx);
      const subtype = info?.expenseType ?? tx.category;
      const cur = subtypeMap.get(subtype) ?? { total: 0, count: 0 };
      cur.total += tx.amount;
      cur.count += 1;
      subtypeMap.set(subtype, cur);
    }

    const subtypes: CategoryBreakdownItem[] = Array.from(subtypeMap.entries())
      .map(([category, data]) => ({
        category,
        total: data.total,
        count: data.count,
        percentage: total > 0 ? (data.total / total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      plate,
      total,
      count: plateTxs.length,
      share: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
      subtypes,
    };
  });
}

export function downloadVehicleReportCSV(
  transactions: Transaction[],
  scopeLabel: string,
  filename = 'arac-raporu.csv'
): void {
  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const headers = [
    'Tarih',
    'Plaka',
    'Masraf Kalemi',
    'Şube',
    'Açıklama',
    'Tutar (TRY)',
  ];

  const rows = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((tx) => {
      const info = getTransactionVehicleInfo(tx);
      return [
        tx.date,
        info?.plate ?? '',
        info?.expenseType ?? tx.category,
        tx.branch,
        tx.description,
        tx.amount.toFixed(2).replace('.', ','),
      ]
        .map((c) => escape(String(c)))
        .join(';');
    });

  const csvContent =
    '\uFEFF' +
    [
      [escape('ARAÇ GİDER RAPORU'), escape(scopeLabel)].join(';'),
      '',
      headers.map(escape).join(';'),
      ...rows,
    ].join('\r\n');

  triggerCSVDownload(csvContent, filename);
}
