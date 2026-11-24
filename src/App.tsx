import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarRange,
  Car,
  Download,
  FileBarChart2,
  Menu,
  Plus,
  Table2,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { AnnualMatrixView } from './components/AnnualMatrixView';
import { CustomerListView } from './components/CustomerListView';
import { LedgerView } from './components/LedgerView';
import { MonthlyReportView } from './components/MonthlyReportView';
import { TransactionForm } from './components/TransactionForm';
import { VehicleReportView } from './components/VehicleReportView';
import { LEGACY_SAMPLE_TRANSACTION_IDS } from './data/sampleTransactions';
import {
  AppView,
  Branch,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  Transaction,
  TransactionType,
} from './types/finance';
import {
  downloadTransactionsCSV,
  extractPlateAndCleanCategory,
  formatMonthLabel,
  formatTRY,
  getDetectedVehiclePlates,
  getMonthKey,
  hasPlateInCategory,
} from './utils/finance';

const STORAGE_KEY = 'mizandefter_transactions_v1';
const CUSTOM_CATEGORIES_KEY = 'yuksel_custom_categories_v1';
const SAMPLES_PURGED_KEY = 'yuksel_samples_purged_v1';
const ACTIVE_VIEW_KEY = 'yuksel_active_view_v1';
const VIEW_FILTERS_KEY = 'yuksel_view_filters_v1';

const VIEW_HASH_MAP: Record<AppView, string> = {
  ledger: '#giris',
  'customers-report': '#musteriler',
  'vehicle-report': '#araclar',
  'monthly-report': '#aylik',
  'annual-matrix': '#yillik',
};

const HASH_TO_VIEW: Record<string, AppView> = {
  '#giris': 'ledger',
  '#musteriler': 'customers-report',
  '#araclar': 'vehicle-report',
  '#aylik': 'monthly-report',
  '#yillik': 'annual-matrix',
  ledger: 'ledger',
  'customers-report': 'customers-report',
  'vehicle-report': 'vehicle-report',
  'monthly-report': 'monthly-report',
  'annual-matrix': 'annual-matrix',
};

function loadInitialActiveView(): AppView {
  try {
    const hash = window.location.hash.toLowerCase();
    if (hash && HASH_TO_VIEW[hash]) {
      return HASH_TO_VIEW[hash];
    }
    const stored =
      sessionStorage.getItem(ACTIVE_VIEW_KEY) ??
      localStorage.getItem(ACTIVE_VIEW_KEY);
    if (stored && HASH_TO_VIEW[stored]) {
      return HASH_TO_VIEW[stored];
    }
  } catch {
    // Ignore storage/location access errors
  }
  return 'ledger';
}

interface ViewFiltersStore {
  ledgerMonth: string;
  reportMonth: string;
  selectedBranch: 'all' | Branch;
}

function loadInitialViewFilters(): ViewFiltersStore {
  try {
    const raw =
      sessionStorage.getItem(VIEW_FILTERS_KEY) ??
      localStorage.getItem(VIEW_FILTERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ViewFiltersStore>;
      return {
        ledgerMonth:
          typeof parsed.ledgerMonth === 'string' && parsed.ledgerMonth
            ? parsed.ledgerMonth
            : '2026-11',
        reportMonth:
          typeof parsed.reportMonth === 'string' && /^\d{4}-\d{2}$/.test(parsed.reportMonth)
            ? parsed.reportMonth
            : '2026-11',
        selectedBranch:
          parsed.selectedBranch === 'Gebze' || parsed.selectedBranch === 'Yenidoğan'
            ? parsed.selectedBranch
            : 'all',
      };
    }
  } catch {
    // Ignore storage read errors
  }
  return {
    ledgerMonth: '2026-11',
    reportMonth: '2026-11',
    selectedBranch: 'all',
  };
}

interface CustomCategoryStore {
  income: string[];
  expense: string[];
}

function loadSavedCustomCategories(): CustomCategoryStore {
  try {
    const raw = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CustomCategoryStore>;
      return {
        income: Array.isArray(parsed.income)
          ? parsed.income.filter(
              (c): c is string =>
                typeof c === 'string' && c.trim().length > 0 && !hasPlateInCategory(c)
            )
          : [],
        expense: Array.isArray(parsed.expense)
          ? parsed.expense.filter(
              (c): c is string =>
                typeof c === 'string' && c.trim().length > 0 && !hasPlateInCategory(c)
            )
          : [],
      };
    }
  } catch {
    // Ignore storage read errors
  }
  return { income: [], expense: [] };
}

function loadInitialTransactions(): Transaction[] {
  try {
    const alreadyPurged = localStorage.getItem(SAMPLES_PURGED_KEY) === '1';
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const mapped = parsed.map((item) => {
          const resolvedBranch =
            item?.branch === 'Gebze' || item?.branch === 'Yenidoğan'
              ? item.branch
              : 'Gebze';
          if (item?.type === 'income') {
            return {
              ...item,
              branch: resolvedBranch,
              paymentMethod: undefined,
            } as Transaction;
          }
          const rawCategory = typeof item?.category === 'string' ? item.category : '';
          const plateMigration = extractPlateAndCleanCategory(rawCategory);
          return {
            ...item,
            branch: resolvedBranch,
            category: plateMigration ? plateMigration.cleanCategory : rawCategory,
            vehiclePlate: item?.vehiclePlate || plateMigration?.plate || undefined,
          } as Transaction;
        });

        const finalTransactions = !alreadyPurged
          ? mapped.filter((tx) => !LEGACY_SAMPLE_TRANSACTION_IDS.has(tx.id))
          : mapped;

        try {
          if (!alreadyPurged) {
            localStorage.setItem(SAMPLES_PURGED_KEY, '1');
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(finalTransactions));
        } catch {
          // Ignore storage write errors
        }
        return finalTransactions;
      }
    }
    if (!alreadyPurged) {
      localStorage.setItem(SAMPLES_PURGED_KEY, '1');
    }
  } catch {
    // Fallback to empty dataset if storage is unavailable or corrupted
  }
  return [];
}

export default function App() {
  const initialFilters = loadInitialViewFilters();
  const [transactions, setTransactions] = useState<Transaction[]>(
    loadInitialTransactions
  );
  const [savedCustomCategories, setSavedCustomCategories] =
    useState<CustomCategoryStore>(loadSavedCustomCategories);
  const [activeView, setActiveView] = useState<AppView>(loadInitialActiveView);
  const [ledgerMonth, setLedgerMonth] = useState<string>(initialFilters.ledgerMonth);
  const [reportMonth, setReportMonth] = useState<string>(initialFilters.reportMonth);
  const [selectedBranch, setSelectedBranch] = useState<'all' | Branch>(
    initialFilters.selectedBranch
  );

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [modalPrefill, setModalPrefill] = useState<{
    type?: TransactionType;
    category?: string;
    vehiclePlate?: string;
  }>({});
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState<boolean>(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(ACTIVE_VIEW_KEY, activeView);
      localStorage.setItem(ACTIVE_VIEW_KEY, activeView);
      const nextHash = VIEW_HASH_MAP[activeView];
      if (nextHash && window.location.hash !== nextHash) {
        window.history.replaceState(null, '', nextHash);
      }
    } catch {
      // Ignore storage or history errors
    }
  }, [activeView]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash && HASH_TO_VIEW[hash]) {
        setActiveView(HASH_TO_VIEW[hash]);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    try {
      const payload = JSON.stringify({
        ledgerMonth,
        reportMonth,
        selectedBranch,
      });
      sessionStorage.setItem(VIEW_FILTERS_KEY, payload);
      localStorage.setItem(VIEW_FILTERS_KEY, payload);
    } catch {
      // Ignore storage quota errors
    }
  }, [ledgerMonth, reportMonth, selectedBranch]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch {
      // Ignore storage quota errors silently
    }
  }, [transactions]);

  useEffect(() => {
    try {
      localStorage.setItem(
        CUSTOM_CATEGORIES_KEY,
        JSON.stringify(savedCustomCategories)
      );
    } catch {
      // Ignore storage quota errors silently
    }
  }, [savedCustomCategories]);

  useEffect(() => {
    if (isModalOpen || isClearConfirmOpen || isMobileNavOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isModalOpen, isClearConfirmOpen, isMobileNavOpen]);

  const customCategories = useMemo(() => {
    const incomeSet = new Set<string>(
      savedCustomCategories.income.filter((c) => !hasPlateInCategory(c))
    );
    const expenseSet = new Set<string>(
      savedCustomCategories.expense.filter((c) => !hasPlateInCategory(c))
    );
    for (const tx of transactions) {
      if (hasPlateInCategory(tx.category)) continue;
      if (
        tx.type === 'income' &&
        !DEFAULT_INCOME_CATEGORIES.includes(tx.category)
      ) {
        incomeSet.add(tx.category);
      }
      if (
        tx.type === 'expense' &&
        !DEFAULT_EXPENSE_CATEGORIES.includes(tx.category)
      ) {
        expenseSet.add(tx.category);
      }
    }
    return {
      income: Array.from(incomeSet),
      expense: Array.from(expenseSet),
    };
  }, [transactions, savedCustomCategories]);

  const knownPlates = useMemo(
    () => getDetectedVehiclePlates(transactions),
    [transactions]
  );

  const overallTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of transactions) {
      if (selectedBranch !== 'all' && tx.branch !== selectedBranch) continue;
      if (tx.type === 'income') income += tx.amount;
      else expense += tx.amount;
    }
    return { income, expense, net: income - expense };
  }, [transactions, selectedBranch]);

  const handleSaveTransaction = (
    data: Omit<Transaction, 'id'>,
    editId?: string
  ) => {
    if (
      data.type === 'income' &&
      !DEFAULT_INCOME_CATEGORIES.includes(data.category)
    ) {
      setSavedCustomCategories((prev) =>
        prev.income.includes(data.category)
          ? prev
          : { ...prev, income: [...prev.income, data.category] }
      );
    } else if (
      data.type === 'expense' &&
      !DEFAULT_EXPENSE_CATEGORIES.includes(data.category)
    ) {
      setSavedCustomCategories((prev) =>
        prev.expense.includes(data.category)
          ? prev
          : { ...prev, expense: [...prev.expense, data.category] }
      );
    }

    if (editId) {
      setTransactions((prev) =>
        prev.map((tx) => (tx.id === editId ? { ...data, id: editId } : tx))
      );
    } else {
      const newTx: Transaction = {
        ...data,
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      };
      setTransactions((prev) => [newTx, ...prev]);

      const txMonth = getMonthKey(data.date);
      if (ledgerMonth !== 'all' && ledgerMonth !== txMonth) {
        setLedgerMonth(txMonth);
      }
      if (activeView === 'monthly-report') {
        setReportMonth(txMonth);
      }
    }

    setIsModalOpen(false);
    setEditingTx(null);
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
  };

  const handleOpenEdit = (tx: Transaction) => {
    setModalPrefill({});
    setEditingTx(tx);
    setIsModalOpen(true);
  };

  const handleOpenNewModal = () => {
    setModalPrefill({});
    setEditingTx(null);
    setIsModalOpen(true);
  };

  const handleOpenVehicleExpenseModal = (plate?: string) => {
    setEditingTx(null);
    setModalPrefill({
      type: 'expense',
      category: 'Yakıt / Ulaşım',
      vehiclePlate: plate ?? '06 GE 3789',
    });
    setIsModalOpen(true);
  };

  const handleJumpToMonthlyReport = (monthKey: string) => {
    setReportMonth(monthKey);
    setActiveView('monthly-report');
    setIsMobileNavOpen(false);
  };

  const handleClearAll = () => {
    setTransactions([]);
    setIsClearConfirmOpen(false);
  };

  const navItems: {
    id: AppView;
    label: string;
    mobileLabel: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'ledger',
      label: 'Giriş',
      mobileLabel: 'Giriş',
      icon: <Table2 className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'customers-report',
      label: 'Müşteri Listesi',
      mobileLabel: 'Müşteriler',
      icon: <Users className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'vehicle-report',
      label: 'Araç Raporu',
      mobileLabel: 'Araçlar',
      icon: <Car className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'monthly-report',
      label: 'Aylık Kâr/Zarar Raporu',
      mobileLabel: 'Aylık',
      icon: <FileBarChart2 className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'annual-matrix',
      label: 'Yıllık Özet',
      mobileLabel: 'Yıllık',
      icon: <CalendarRange className="w-4 h-4 shrink-0" />,
    },
  ];

  const branchSuffix =
    selectedBranch === 'all' ? 'Tüm Şubeler' : `${selectedBranch} Şubesi`;

  const breadcrumbText =
    activeView === 'ledger'
      ? `Yüksel Elektronik / Giriş · ${branchSuffix} · ${
          ledgerMonth === 'all' ? 'Tüm Aylar' : formatMonthLabel(ledgerMonth)
        }`
      : activeView === 'customers-report'
      ? `Yüksel Elektronik / Müşteri Listesi · ${branchSuffix}`
      : activeView === 'vehicle-report'
      ? `Yüksel Elektronik / Araç Raporu · ${branchSuffix}`
      : activeView === 'monthly-report'
      ? `Yüksel Elektronik / Aylık Kâr-Zarar · ${branchSuffix} · ${formatMonthLabel(reportMonth)}`
      : `Yüksel Elektronik / Yıllık Finansal Matris · ${branchSuffix}`;

  return (
    <div className="min-h-screen flex bg-[#F4F6F9] text-slate-900">
      {/* Desktop Left Sidebar */}
      <aside className="no-print hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="h-16 px-6 flex items-center border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveView('ledger')}
            className="font-display text-lg font-bold tracking-tight text-[#0F1D36] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Yüksel Elektronik
          </button>
        </div>

        <nav aria-label="Ana Menü" className="flex-1 px-3 py-5 space-y-1">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#0F1D36] text-white'
                    : 'text-slate-600 hover:text-[#0F1D36] hover:bg-slate-100'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-500">
              Genel Bakiye ({transactions.length} kayıt)
            </p>
            <p
              className={`text-base font-semibold font-mono tabular-nums ${
                overallTotals.net >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {formatTRY(overallTotals.net, true)}
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-1">
            <button
              type="button"
              onClick={() => downloadTransactionsCSV(transactions)}
              disabled={transactions.length === 0}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors disabled:opacity-40 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tüm Verileri CSV İndir</span>
            </button>
            <button
              type="button"
              onClick={() => setIsClearConfirmOpen(true)}
              disabled={transactions.length === 0}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-40 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Tabloyu Sıfırla</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {isMobileNavOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setIsMobileNavOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-white h-full border-r border-slate-200 flex flex-col overflow-y-auto overscroll-contain z-50">
            <div className="h-16 px-5 shrink-0 flex items-center justify-between border-b border-slate-200">
              <span className="font-display text-lg font-bold text-[#0F1D36]">
                Yüksel Elektronik
              </span>
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                aria-label="Menüyü kapat"
                className="p-2 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => {
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveView(item.id);
                      setIsMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#0F1D36] text-white'
                        : 'text-slate-600 hover:text-[#0F1D36] hover:bg-slate-100'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200 space-y-2">
              <button
                type="button"
                onClick={() => {
                  downloadTransactionsCSV(transactions);
                  setIsMobileNavOpen(false);
                }}
                disabled={transactions.length === 0}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 rounded-lg"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV İndir</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMobileNavOpen(false);
                  setIsClearConfirmOpen(true);
                }}
                disabled={transactions.length === 0}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-700 bg-rose-50 rounded-lg"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Tabloyu Sıfırla</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on Left, Single Primary CTA on Right (non-sticky on mobile to keep sticky bar <= 15%) */}
        <header className="no-print h-14 sm:h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-3 lg:sticky lg:top-0 z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              aria-label="Menüyü aç"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-[#0F1D36] rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <p className="text-xs sm:text-sm font-semibold sm:font-medium text-[#0F1D36] sm:text-slate-700 truncate">
              {breadcrumbText}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleOpenNewModal}
              className="h-9 px-3.5 sm:px-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0F1D36] rounded-lg hover:bg-[#172b4d] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F1D36]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yeni Kayıt</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 pb-20 lg:pb-8 max-w-[1360px] w-full mx-auto">
          {activeView === 'ledger' && (
            <LedgerView
              transactions={transactions}
              selectedMonth={ledgerMonth}
              onSelectMonth={setLedgerMonth}
              selectedBranch={selectedBranch}
              onSelectBranch={setSelectedBranch}
              knownPlates={knownPlates}
              customCategories={customCategories}
              onAddTransaction={(data) => handleSaveTransaction(data)}
              onEditRequest={handleOpenEdit}
              onDeleteTransaction={handleDeleteTransaction}
            />
          )}

          {activeView === 'monthly-report' && (
            <MonthlyReportView
              transactions={transactions}
              reportMonth={reportMonth}
              onChangeReportMonth={setReportMonth}
              selectedBranch={selectedBranch}
              onSelectBranch={setSelectedBranch}
              onOpenCustomersReport={() => setActiveView('customers-report')}
              onAddNewClick={handleOpenNewModal}
            />
          )}

          {activeView === 'customers-report' && (
            <CustomerListView
              transactions={transactions}
              selectedBranch={selectedBranch}
              onSelectBranch={setSelectedBranch}
              onAddNewClick={handleOpenNewModal}
            />
          )}

          {activeView === 'vehicle-report' && (
            <VehicleReportView
              transactions={transactions}
              selectedBranch={selectedBranch}
              onSelectBranch={setSelectedBranch}
              onAddVehicleExpense={handleOpenVehicleExpenseModal}
            />
          )}

          {activeView === 'annual-matrix' && (
            <AnnualMatrixView
              transactions={transactions}
              selectedBranch={selectedBranch}
              onSelectBranch={setSelectedBranch}
              onOpenMonthReport={handleJumpToMonthlyReport}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom App Tab Bar */}
      <nav
        aria-label="Mobil Alt Menü"
        className="no-print fixed bottom-0 inset-x-0 z-30 h-14 bg-white/95 backdrop-blur-xs border-t border-slate-200 grid grid-cols-5 lg:hidden"
      >
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'text-[#0F1D36] font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span
                className={`p-1 rounded-md transition-colors ${
                  isActive ? 'bg-[#0F1D36]/10 text-[#0F1D36]' : ''
                }`}
              >
                {item.icon}
              </span>
              <span className="leading-none truncate max-w-full px-0.5">{item.mobileLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Add / Edit Transaction Modal */}
      {isModalOpen && (
        <div
          className="no-print fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-900/45 p-3 sm:p-4 flex items-start sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tx-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain p-4 sm:p-6 my-auto shadow-xl">
            <h2 id="tx-modal-title" className="text-base font-semibold text-slate-900 mb-4">
              {editingTx ? 'Kaydı Düzenle' : 'Yeni Gelir / Gider Kaydı'}
            </h2>
            <TransactionForm
              mode="modal"
              initialData={editingTx}
              defaultMonthKey={
                activeView === 'monthly-report' ? reportMonth : ledgerMonth
              }
              defaultBranch={selectedBranch}
              defaultType={modalPrefill.type}
              defaultCategory={modalPrefill.category}
              defaultVehiclePlate={modalPrefill.vehiclePlate}
              knownPlates={knownPlates}
              customCategories={customCategories}
              onSubmit={handleSaveTransaction}
              onCancel={() => {
                setIsModalOpen(false);
                setEditingTx(null);
                setModalPrefill({});
              }}
            />
          </div>
        </div>
      )}

      {/* Clear All Data Confirmation Modal */}
      {isClearConfirmOpen && (
        <div
          className="no-print fixed inset-0 z-50 overflow-y-auto overscroll-contain flex items-center justify-center p-4 bg-slate-900/45"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 shadow-xl">
            <h2 id="clear-modal-title" className="text-base font-semibold text-slate-900">
              Tüm kayıtlar silinsin mi?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Tablodaki mevcut {transactions.length} gelir ve gider kaydının tamamı temizlenecektir. İsterseniz sıfırlamadan önce CSV olarak dışa aktarabilirsiniz.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(false)}
                className="h-9 px-4 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="h-9 px-4 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
              >
                Evet, Tabloyu Sıfırla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
