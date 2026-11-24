import React, { useMemo, useState } from 'react';
import { Download, Phone, Plus, Printer, Search, X } from 'lucide-react';
import { BRANCHES, Branch, Transaction } from '../types/finance';
import {
  calculateRemainingWarranty,
  downloadCustomerListCSV,
  formatDateTR,
  formatMonthLabel,
  formatTRY,
  getAvailableMonths,
  getMonthKey,
  toTelHref,
} from '../utils/finance';

interface CustomerListViewProps {
  transactions: Transaction[];
  selectedBranch: 'all' | Branch;
  onSelectBranch: (branch: 'all' | Branch) => void;
  onAddNewClick: () => void;
}

export const CustomerListView: React.FC<CustomerListViewProps> = ({
  transactions,
  selectedBranch,
  onSelectBranch,
  onAddNewClick,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [warrantyFilter, setWarrantyFilter] = useState<'all' | 'with' | 'without'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const availableMonths = useMemo(
    () => getAvailableMonths(transactions, '2026-11'),
    [transactions]
  );

  const customerRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions
      .filter((tx) => {
        if (tx.type !== 'income') return false;
        if (selectedBranch !== 'all' && tx.branch !== selectedBranch) return false;
        if (selectedMonth !== 'all' && getMonthKey(tx.date) !== selectedMonth) {
          return false;
        }
        const hasWarranty = Boolean(
          tx.warrantyPeriod &&
            tx.warrantyPeriod.trim() &&
            tx.warrantyPeriod.trim().toLowerCase() !== 'garanti yok'
        );
        if (warrantyFilter === 'with' && !hasWarranty) return false;
        if (warrantyFilter === 'without' && hasWarranty) return false;
        if (q) {
          const hay = `${tx.customerName ?? ''} ${tx.customerPhone ?? ''} ${
            tx.warrantyPeriod ?? ''
          } ${tx.description} ${tx.branch} ${tx.documentNo ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, selectedBranch, selectedMonth, warrantyFilter, searchQuery]);

  const stats = useMemo(() => {
    const totalIncome = customerRecords.reduce((s, tx) => s + tx.amount, 0);
    return {
      totalCount: customerRecords.length,
      totalIncome,
    };
  }, [customerRecords]);

  const scopeLabel =
    selectedBranch === 'all' ? 'Tüm Şubeler' : `${selectedBranch} Şubesi`;

  return (
    <div className="space-y-6">
      {/* Print-only formal letterhead */}
      <div className="hidden print-only border-b-2 border-[#0F1D36] pb-4 mb-4">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#0F1D36]">
              Yüksel Elektronik · Müşteri Listesi Raporu
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Kapsam: {scopeLabel} ·{' '}
              {selectedMonth === 'all' ? 'Tüm Dönemler' : formatMonthLabel(selectedMonth)} ·{' '}
              {stats.totalCount} Kayıt
            </p>
          </div>
          <p className="text-xs font-mono text-slate-500">Rapor Tarihi: 24.11.2026</p>
        </div>
      </div>

      {/* Search & Filter Bar (Visible on mobile and desktop above Customer List) */}
      <section className="no-print bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Customer Search Input */}
          <div className="relative w-full md:w-72 md:order-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Müşteri adı veya telefon ara..."
              aria-label="Müşteri adı ile ara"
              className="w-full h-10 md:h-9 pl-9 pr-9 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Aramayı temizle"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-2 md:order-1">
            <select
              aria-label="Dönem Seçimi"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-10 md:h-9 px-3 text-xs sm:text-sm font-medium bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
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
                  className={`px-2.5 sm:px-3 py-1.5 md:py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedBranch === b
                      ? 'bg-[#0F1D36] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {b === 'all' ? 'Tüm Şubeler' : b}
                </button>
              ))}
            </div>

            <div
              role="group"
              aria-label="Garanti Durumu Filtresi"
              className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200"
            >
              {(
                [
                  { id: 'all', label: 'Tümü' },
                  { id: 'with', label: 'Garantili' },
                  { id: 'without', label: 'Garantisiz' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setWarrantyFilter(opt.id)}
                  className={`px-2.5 sm:px-3 py-1.5 md:py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    warrantyFilter === opt.id
                      ? 'bg-[#0F1D36] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Desktop Export / Print Buttons */}
          <div className="hidden md:flex items-center gap-2 md:order-3 shrink-0">
            <button
              type="button"
              onClick={() => downloadCustomerListCSV(customerRecords)}
              disabled={customerRecords.length === 0}
              className="h-9 px-3.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV İndir</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="h-9 px-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0F1D36] rounded-lg hover:bg-[#172b4d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Yazdır / PDF</span>
            </button>
          </div>
        </div>
      </section>

      {/* Customer Directory Table / Mobile List */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 bg-[#F8FAFC] flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#0F1D36]">
              Müşteri Listesi ({customerRecords.length} Kayıt)
            </h2>
            <p className="hidden sm:block text-xs text-slate-500 mt-0.5">
              Gelir kayıtlarına eklenen müşteri/firma adı, telefon ve garanti bitiş tarihi
            </p>
          </div>
          <span className="text-xs font-medium text-slate-600 whitespace-nowrap">{scopeLabel}</span>
        </div>

        {customerRecords.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-semibold text-[#0F1D36]">
              Listelenecek müşteri kaydı bulunamadı
            </p>
            <p className="mt-1.5 text-xs text-slate-500 max-w-md mx-auto">
              Yeni gelir kaydı eklerken müşteri/firma adı, telefon ve garanti süresi bilgilerini girebilirsiniz.
            </p>
            <button
              type="button"
              onClick={onAddNewClick}
              className="mt-5 h-9 px-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0F1D36] rounded-lg hover:bg-[#172b4d] transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yeni Gelir Kaydı Ekle</span>
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Clean List */}
            <div className="md:hidden divide-y divide-slate-100">
              {customerRecords.map((tx) => {
                const remaining = calculateRemainingWarranty(
                  tx.date,
                  tx.warrantyPeriod
                );
                const endDateColor =
                  remaining.status === 'expired'
                    ? 'text-rose-700 font-semibold'
                    : remaining.status === 'expiring'
                    ? 'text-amber-700 font-semibold'
                    : remaining.status === 'active' || remaining.status === 'lifetime'
                    ? 'text-slate-900 font-semibold'
                    : 'text-slate-400 font-normal';

                const endDateDisplay =
                  remaining.endDateStr ??
                  (remaining.status === 'lifetime' ? 'Süresiz' : '—');

                return (
                  <div key={tx.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {tx.customerName || (
                            <span className="font-normal text-slate-400">
                              Müşteri belirtilmedi
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {tx.branch} · {formatDateTR(tx.date)}
                        </p>
                      </div>
                      <span className="text-sm font-mono tabular-nums font-semibold text-emerald-700 whitespace-nowrap shrink-0">
                        {formatTRY(tx.amount)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      {tx.customerPhone ? (
                        <a
                          href={toTelHref(tx.customerPhone)}
                          className="inline-flex items-center gap-1.5 min-h-[40px] px-2.5 -ml-2.5 text-xs font-mono tabular-nums font-semibold text-slate-900 hover:text-emerald-700 underline underline-offset-4 rounded-lg active:bg-slate-100"
                        >
                          <Phone className="w-3.5 h-3.5 shrink-0 text-emerald-700" />
                          <span>{tx.customerPhone}</span>
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">Telefon yok</span>
                      )}

                      <div className="text-right text-xs">
                        <span className="text-slate-500">Garanti Bitiş: </span>
                        <span className={`font-mono tabular-nums ${endDateColor}`}>
                          {endDateDisplay}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-5 whitespace-nowrap">Müşteri / Firma Adı</th>
                    <th className="py-3 px-4 whitespace-nowrap">Telefon</th>
                    <th className="py-3 px-4 whitespace-nowrap">Garanti Bitiş</th>
                    <th className="py-3 px-4 whitespace-nowrap">Şube</th>
                    <th className="py-3 px-4 whitespace-nowrap">İşlem Tarihi</th>
                    <th className="py-3 px-4">Açıklama</th>
                    <th className="py-3 px-5 text-right whitespace-nowrap">Tutar (₺)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {customerRecords.map((tx) => {
                    const remaining = calculateRemainingWarranty(
                      tx.date,
                      tx.warrantyPeriod
                    );
                    const endDateColor =
                      remaining.status === 'expired'
                        ? 'text-rose-700 font-semibold'
                        : remaining.status === 'expiring'
                        ? 'text-amber-700 font-semibold'
                        : remaining.status === 'active' || remaining.status === 'lifetime'
                        ? 'text-slate-800 font-medium'
                        : 'text-slate-400 font-normal';

                    const endDateDisplay =
                      remaining.endDateStr ??
                      (remaining.status === 'lifetime' ? 'Süresiz' : '—');

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-5 font-semibold text-slate-900 whitespace-nowrap">
                          {tx.customerName || (
                            <span className="font-normal text-slate-400">Belirtilmedi</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-xs whitespace-nowrap">
                          {tx.customerPhone ? (
                            <a
                              href={toTelHref(tx.customerPhone)}
                              className="inline-flex items-center gap-1.5 font-medium text-slate-800 hover:text-emerald-700 underline underline-offset-4"
                            >
                              <Phone className="w-3 h-3 shrink-0 text-slate-400" />
                              <span>{tx.customerPhone}</span>
                            </a>
                          ) : (
                            <span className="font-sans text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono tabular-nums whitespace-nowrap">
                          <span className={endDateColor}>{endDateDisplay}</span>
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold text-slate-700 whitespace-nowrap">
                          {tx.branch}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                          {formatDateTR(tx.date)}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700 min-w-[200px]">
                          <span>{tx.description}</span>
                          {tx.documentNo && (
                            <span className="ml-1.5 font-mono text-slate-400">
                              · {tx.documentNo}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-5 text-right font-mono tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                          {formatTRY(tx.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900">
                    <td colSpan={6} className="py-3 px-5">
                      Toplam {customerRecords.length} kayıt
                    </td>
                    <td className="py-3 px-5 text-right font-mono tabular-nums text-sm text-emerald-700">
                      {formatTRY(stats.totalIncome)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
};
