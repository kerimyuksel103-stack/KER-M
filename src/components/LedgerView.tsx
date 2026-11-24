import React, { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { BRANCHES, Branch, Transaction, TransactionType } from '../types/finance';
import {
  formatDateTR,
  formatMonthLabel,
  formatTRY,
  getAvailableMonths,
  getMonthKey,
  getTransactionVehicleInfo,
  toTelHref,
} from '../utils/finance';
import { TransactionForm } from './TransactionForm';

interface LedgerViewProps {
  transactions: Transaction[];
  selectedMonth: string; // YYYY-MM or 'all'
  onSelectMonth: (monthKey: string) => void;
  selectedBranch: 'all' | Branch;
  onSelectBranch: (branch: 'all' | Branch) => void;
  knownPlates: string[];
  customCategories: { income: string[]; expense: string[] };
  onAddTransaction: (data: Omit<Transaction, 'id'>) => void;
  onEditRequest: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

type SortField = 'date' | 'amount' | 'type' | 'branch';
type SortDirection = 'asc' | 'desc';

export const LedgerView: React.FC<LedgerViewProps> = ({
  transactions,
  selectedMonth,
  onSelectMonth,
  selectedBranch,
  onSelectBranch,
  knownPlates,
  customCategories,
  onAddTransaction,
  onEditRequest,
  onDeleteTransaction,
}) => {
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isEntryOpen, setIsEntryOpen] = useState<boolean>(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const availableMonths = useMemo(
    () => getAvailableMonths(transactions, '2026-11'),
    [transactions]
  );

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const tx of transactions) {
      set.add(tx.category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (selectedMonth !== 'all' && getMonthKey(tx.date) !== selectedMonth) {
        return false;
      }
      if (selectedBranch !== 'all' && tx.branch !== selectedBranch) {
        return false;
      }
      if (typeFilter !== 'all' && tx.type !== typeFilter) {
        return false;
      }
      if (categoryFilter !== 'all' && tx.category !== categoryFilter) {
        return false;
      }
      if (q) {
        const hay = `${tx.branch} ${tx.description} ${tx.category} ${tx.vehiclePlate ?? ''} ${tx.customerName ?? ''} ${tx.customerPhone ?? ''} ${tx.warrantyPeriod ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, selectedMonth, selectedBranch, typeFilter, categoryFilter, searchQuery]);

  // Calculate chronological running balance over filtered set
  const runningBalanceMap = useMemo(() => {
    const chronological = [...filteredTransactions].sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
    });
    const map = new Map<string, number>();
    let acc = 0;
    for (const tx of chronological) {
      acc += tx.type === 'income' ? tx.amount : -tx.amount;
      map.set(tx.id, acc);
    }
    return map;
  }, [filteredTransactions]);

  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        cmp = a.date.localeCompare(b.date);
        if (cmp === 0) cmp = a.id.localeCompare(b.id);
      } else if (sortField === 'amount') {
        const aVal = a.type === 'income' ? a.amount : -a.amount;
        const bVal = b.type === 'income' ? b.amount : -b.amount;
        cmp = aVal - bVal;
      } else if (sortField === 'type') {
        cmp = a.type.localeCompare(b.type);
      } else if (sortField === 'branch') {
        cmp = a.branch.localeCompare(b.branch, 'tr');
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredTransactions, sortField, sortDirection]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of filteredTransactions) {
      if (tx.type === 'income') {
        income += tx.amount;
      } else {
        expense += tx.amount;
      }
    }
    const net = income - expense;
    return { income, expense, net };
  }, [filteredTransactions]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const scopeLabel =
    selectedBranch === 'all' ? 'Tüm Şubeler' : `${selectedBranch} Şubesi`;

  return (
    <div className="space-y-6">
      {/* Inline Veri Giriş Alanı */}
      <section className="bg-white border border-slate-200 rounded-xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Yeni Gelir / Gider Veri Girişi
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Şube (Gebze veya Yenidoğan), tarih, kategori, açıklama ve tutar girerek kâr-zarar tablosunu güncelleyin.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsEntryOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>{isEntryOpen ? 'Formu Gizle' : 'Formu Aç'}</span>
            {isEntryOpen ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {isEntryOpen && (
          <div className="p-5">
            <TransactionForm
              mode="inline"
              defaultMonthKey={selectedMonth}
              defaultBranch={selectedBranch}
              knownPlates={knownPlates}
              customCategories={customCategories}
              onSubmit={(data) => onAddTransaction(data)}
            />
          </div>
        )}
      </section>

      {/* Filter & Search Toolbar + Main P&L Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Dönem Seçimi"
              value={selectedMonth}
              onChange={(e) => onSelectMonth(e.target.value)}
              className="h-9 px-3 text-sm font-medium bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            >
              <option value="all">Tüm Aylar</option>
              {availableMonths.map((mk) => (
                <option key={mk} value={mk}>
                  {formatMonthLabel(mk)}
                </option>
              ))}
            </select>

            <div
              role="group"
              aria-label="Şube Filtresi"
              className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200"
            >
              {(['all', ...BRANCHES] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => onSelectBranch(b)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedBranch === b
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {b === 'all' ? 'Tüm Şubeler' : b}
                </button>
              ))}
            </div>

            <div
              role="group"
              aria-label="Tür Filtresi"
              className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200"
            >
              {(['all', 'income', 'expense'] as const).map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setTypeFilter(val)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    typeFilter === val
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {val === 'all' ? 'Tümü' : val === 'income' ? 'Gelirler' : 'Giderler'}
                </button>
              ))}
            </div>

            <select
              aria-label="Kategori Filtresi"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            >
              <option value="all">Tüm Kategoriler</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Müşteri, açıklama, şube veya belge ara..."
              className="w-full h-9 pl-9 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            />
          </div>
        </div>

        {sortedTransactions.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-semibold text-slate-900">
              {transactions.length === 0
                ? 'Henüz gelir veya gider kaydı bulunmuyor'
                : 'Seçilen filtrelerle eşleşen kayıt yok'}
            </p>
            <p className="mt-1.5 text-xs text-slate-500 max-w-md mx-auto">
              {transactions.length === 0
                ? 'Yukarıdaki veri giriş alanını kullanarak Gebze veya Yenidoğan şubesi için ilk gelir veya gider kaydınızı ekleyebilirsiniz.'
                : 'Dönem, şube, tür veya arama filtresini temizleyerek tüm kayıtları yeniden görüntüleyebilirsiniz.'}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              {transactions.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setIsEntryOpen(true)}
                  className="h-9 px-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0F1D36] rounded-lg hover:bg-[#172b4d] transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>İlk Kaydı Gir</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onSelectMonth('all');
                    onSelectBranch('all');
                    setTypeFilter('all');
                    setCategoryFilter('all');
                    setSearchQuery('');
                  }}
                  className="h-9 px-4 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Filtreleri Temizle
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('date')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                    >
                      <span>Tarih</span>
                      <ArrowDownUp className="w-3 h-3 text-slate-400" />
                    </button>
                  </th>
                  <th className="py-2.5 px-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('branch')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                    >
                      <span>Şube</span>
                      <ArrowDownUp className="w-3 h-3 text-slate-400" />
                    </button>
                  </th>
                  <th className="py-2.5 px-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('type')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                    >
                      <span>Tür</span>
                      <ArrowDownUp className="w-3 h-3 text-slate-400" />
                    </button>
                  </th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Kategori</th>
                  <th className="py-2.5 px-4">Açıklama</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Müşteri / Plaka</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('amount')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer ml-auto"
                    >
                      <span>Tutar (₺)</span>
                      <ArrowDownUp className="w-3 h-3 text-slate-400" />
                    </button>
                  </th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">
                    Kümülatif Bakiye
                  </th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {sortedTransactions.map((tx) => {
                  const running = runningBalanceMap.get(tx.id) ?? 0;
                  const isConfirming = confirmDeleteId === tx.id;
                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                        {formatDateTR(tx.date)}
                      </td>
                      <td className="py-2.5 px-4 text-xs font-semibold text-slate-800 whitespace-nowrap">
                        {tx.branch}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold ${
                            tx.type === 'income' ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {tx.type === 'income' ? '+ Gelir' : '− Gider'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-xs font-medium text-slate-700 whitespace-nowrap">
                        {tx.category}
                      </td>
                      <td className="py-2.5 px-4 text-slate-900 min-w-[210px]">
                        <div className="flex items-baseline gap-2">
                          <span className="font-medium text-slate-900">
                            {tx.description}
                          </span>
                          {tx.documentNo && (
                            <span className="text-xs font-mono text-slate-400 whitespace-nowrap">
                              · {tx.documentNo}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {tx.type === 'income' ? (
                          tx.customerName || tx.customerPhone || tx.warrantyPeriod ? (
                            <div>
                              <span className="font-medium text-slate-800">
                                {tx.customerName || 'Müşteri belirtilmedi'}
                              </span>
                              {(tx.customerPhone || tx.warrantyPeriod) && (
                                <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                                  {tx.customerPhone && (
                                    <a
                                      href={toTelHref(tx.customerPhone)}
                                      className="hover:text-emerald-700 underline underline-offset-2"
                                    >
                                      {tx.customerPhone}
                                    </a>
                                  )}
                                  {tx.customerPhone && tx.warrantyPeriod && ' · '}
                                  {tx.warrantyPeriod && `Garanti: ${tx.warrantyPeriod}`}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )
                        ) : (
                          (() => {
                            const vehicleInfo = getTransactionVehicleInfo(tx);
                            return vehicleInfo ? (
                              <span className="font-mono font-semibold text-[#0F1D36]">
                                {vehicleInfo.plate}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            );
                          })()
                        )}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-mono tabular-nums font-medium whitespace-nowrap ${
                          tx.type === 'income' ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {tx.type === 'income'
                          ? formatTRY(tx.amount, true)
                          : formatTRY(-tx.amount)}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-mono tabular-nums text-xs whitespace-nowrap ${
                          running >= 0 ? 'text-slate-700' : 'text-rose-700 font-medium'
                        }`}
                      >
                        {formatTRY(running, true)}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {isConfirming ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteTransaction(tx.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded transition-colors cursor-pointer"
                            >
                              Sil
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              İptal
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditRequest(tx)}
                              title="Kaydı düzenle"
                              aria-label={`${tx.description} kaydını düzenle`}
                              className="p-1.5 text-slate-400 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(tx.id)}
                              title="Kaydı sil"
                              aria-label={`${tx.description} kaydını sil`}
                              className="p-1.5 text-slate-400 hover:text-rose-700 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-xs text-slate-900">
                  <td colSpan={6} className="py-3 px-4">
                    Tablo Toplamı ({sortedTransactions.length} kayıt · {scopeLabel}) · Gelir:{' '}
                    <span className="font-mono tabular-nums text-emerald-700">
                      {formatTRY(totals.income)}
                    </span>{' '}
                    · Gider:{' '}
                    <span className="font-mono tabular-nums text-rose-700">
                      {formatTRY(totals.expense)}
                    </span>
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono tabular-nums text-sm ${
                      totals.net >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {formatTRY(totals.net, true)}
                  </td>
                  <td colSpan={2} className="py-3 px-4 text-right text-slate-500 font-normal">
                    {totals.net >= 0 ? 'Net Kâr' : 'Net Zarar'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
