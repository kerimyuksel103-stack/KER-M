import React, { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { BRANCHES, Branch, Transaction } from '../types/finance';
import {
  calculateBranchBreakdown,
  calculateMonthlyPnL,
  formatPercent,
  formatTRY,
  getAvailableYears,
  TURKISH_MONTHS,
} from '../utils/finance';
import { MonthlyComparisonCanvas } from './ReportCanvases';

interface AnnualMatrixViewProps {
  transactions: Transaction[];
  selectedBranch: 'all' | Branch;
  onSelectBranch: (branch: 'all' | Branch) => void;
  onOpenMonthReport: (monthKey: string) => void;
}

export const AnnualMatrixView: React.FC<AnnualMatrixViewProps> = ({
  transactions,
  selectedBranch,
  onSelectBranch,
  onOpenMonthReport,
}) => {
  const availableYears = useMemo(
    () => getAvailableYears(transactions, 2026),
    [transactions]
  );
  const [selectedYear, setSelectedYear] = useState<number>(availableYears[0] ?? 2026);

  const yearTransactions = useMemo(
    () => transactions.filter((tx) => tx.date.startsWith(`${selectedYear}-`)),
    [transactions, selectedYear]
  );

  const annualBranchBreakdown = useMemo(
    () => calculateBranchBreakdown(yearTransactions),
    [yearTransactions]
  );

  const monthlyRows = useMemo(() => {
    return TURKISH_MONTHS.map((monthName, idx) => {
      const monthKey = `${selectedYear}-${String(idx + 1).padStart(2, '0')}`;
      const summary = calculateMonthlyPnL(transactions, monthKey, selectedBranch);
      return {
        monthName,
        ...summary,
      };
    });
  }, [transactions, selectedYear, selectedBranch]);

  const latestActiveMonthKey = useMemo(() => {
    const active = [...monthlyRows].reverse().find((r) => r.transactionCount > 0);
    return active?.monthKey ?? `${selectedYear}-11`;
  }, [monthlyRows, selectedYear]);

  const annualTotals = useMemo(() => {
    const income = monthlyRows.reduce((s, r) => s + r.income, 0);
    const expense = monthlyRows.reduce((s, r) => s + r.expense, 0);
    const net = income - expense;
    const margin = income > 0 ? (net / income) * 100 : null;
    const count = monthlyRows.reduce((s, r) => s + r.transactionCount, 0);
    return { income, expense, net, margin, count };
  }, [monthlyRows]);

  const scopeLabel =
    selectedBranch === 'all'
      ? 'Tüm Şubeler (Konsolide)'
      : `${selectedBranch} Şubesi`;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Year & Branch Selector */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[#0F1D36]">
            {selectedYear} Yılı Kâr / Zarar Matrisi · {scopeLabel}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            12 aylık gelir, gider ve net kâr performansını karşılaştırın. Detaylı rapor için aya tıklayın.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2.5 sm:gap-3">
          <div
            role="group"
            aria-label="Yıllık Şube Kapsamı"
            className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200"
          >
            {(['all', ...BRANCHES] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => onSelectBranch(b)}
                className={`px-3 py-1.5 sm:py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedBranch === b
                    ? 'bg-[#0F1D36] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {b === 'all' ? 'Konsolide' : `${b} Şubesi`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="year-select" className="text-xs font-medium text-slate-600">
              Mali Yıl
            </label>
            <select
              id="year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="h-9 px-3 text-sm font-mono font-semibold bg-white border border-slate-200 rounded-lg text-[#0F1D36] focus:outline-none focus:ring-2 focus:ring-[#0F1D36]/15"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Annual Executive Totals + Branch Comparison */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden">
        {annualBranchBreakdown.map((b) => (
          <div key={b.branch} className="bg-white p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#0F1D36]">
                {b.branch} Şubesi · {selectedYear} Toplamı
              </p>
              <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                Gelir: <span className="text-emerald-700 font-medium">{formatTRY(b.income)}</span> · Gider:{' '}
                <span className="text-rose-700 font-medium">{formatTRY(b.expense)}</span>
              </p>
            </div>
            <div className="text-right shrink-0">
              <p
                className={`text-base sm:text-lg font-semibold font-mono tabular-nums ${
                  b.net > 0
                    ? 'text-emerald-700'
                    : b.net < 0
                    ? 'text-rose-700'
                    : 'text-slate-900'
                }`}
              >
                {formatTRY(b.net, true)}
              </p>
              <p className="text-xs text-slate-500 font-mono tabular-nums">
                Marj: {formatPercent(b.margin)}
              </p>
            </div>
          </div>
        ))}
      </section>

      {/* 12-Month Canvas Comparison Chart */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-[#0F1D36]">
            {selectedYear} Aylık Gelir, Gider ve Net Kâr Seyri ({scopeLabel})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Grafik üzerinde gezinin veya ilgili ayın raporunu açmak için dokunun.
          </p>
        </div>

        <MonthlyComparisonCanvas
          months={monthlyRows}
          selectedMonthKey={latestActiveMonthKey}
          onSelectMonth={onOpenMonthReport}
          height={240}
        />
      </section>

      {/* 12-Month Matrix: Mobile List + Desktop Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Mobile App Annual Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {monthlyRows.map((row) => {
            const hasData = row.transactionCount > 0;
            return (
              <button
                key={row.monthKey}
                type="button"
                onClick={() => onOpenMonthReport(row.monthKey)}
                className={`w-full text-left p-4 flex items-center justify-between gap-3 active:bg-slate-50 transition-colors cursor-pointer ${
                  hasData ? '' : 'opacity-60'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#0F1D36]">
                      {row.monthName} {selectedYear}
                    </span>
                    <span className="text-xs font-mono text-slate-400 tabular-nums">
                      ({row.transactionCount} işlem)
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-mono tabular-nums text-slate-500">
                    {hasData
                      ? `Gelir ${formatTRY(row.income)} · Gider ${formatTRY(row.expense)}`
                      : 'Kayıt bulunmuyor'}
                  </p>
                </div>

                <div className="text-right shrink-0 flex items-center gap-2">
                  <div>
                    <p
                      className={`text-sm font-mono tabular-nums font-semibold ${
                        !hasData
                          ? 'text-slate-400'
                          : row.net > 0
                          ? 'text-emerald-700'
                          : row.net < 0
                          ? 'text-rose-700'
                          : 'text-slate-900'
                      }`}
                    >
                      {hasData ? formatTRY(row.net, true) : '—'}
                    </p>
                    <p className="text-[11px] font-mono tabular-nums text-slate-500">
                      Marj {formatPercent(row.margin)}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
              </button>
            );
          })}

          <div className="p-4 bg-[#F8FAFC] border-t-2 border-slate-200 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#0F1D36]">
                {selectedYear} Yıllık Toplam ({annualTotals.count} işlem)
              </p>
              <p className="mt-0.5 text-xs font-mono tabular-nums text-slate-600">
                {formatTRY(annualTotals.income)} · {formatTRY(-annualTotals.expense)}
              </p>
            </div>
            <div className="text-right">
              <p
                className={`text-base font-bold font-mono tabular-nums ${
                  annualTotals.net >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatTRY(annualTotals.net, true)}
              </p>
              <p className="text-[11px] font-mono tabular-nums text-slate-500">
                Marj {formatPercent(annualTotals.margin)}
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Ay</th>
                <th className="py-3 px-4 text-right">İşlem</th>
                <th className="py-3 px-4 text-right">Gelir (₺)</th>
                <th className="py-3 px-4 text-right">Gider (₺)</th>
                <th className="py-3 px-4 text-right">Net Kâr / Zarar (₺)</th>
                <th className="py-3 px-4 text-right">Kâr Marjı</th>
                <th className="py-3 px-4">Durum</th>
                <th className="py-3 px-4 text-right">Aylık Rapor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {monthlyRows.map((row) => {
                const hasData = row.transactionCount > 0;
                return (
                  <tr
                    key={row.monthKey}
                    className={`transition-colors ${
                      hasData ? 'hover:bg-slate-50' : 'text-slate-400'
                    }`}
                  >
                    <td className="py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {row.monthName} {selectedYear}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs text-slate-500">
                      {row.transactionCount}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap">
                      {hasData ? formatTRY(row.income) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-rose-700 whitespace-nowrap">
                      {hasData ? formatTRY(row.expense) : '—'}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                        !hasData
                          ? 'text-slate-400'
                          : row.net > 0
                          ? 'text-emerald-700'
                          : row.net < 0
                          ? 'text-rose-700'
                          : 'text-slate-900'
                      }`}
                    >
                      {hasData ? formatTRY(row.net, true) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs text-slate-600">
                      {formatPercent(row.margin)}
                    </td>
                    <td className="py-2.5 px-4 text-xs font-medium whitespace-nowrap">
                      {!hasData ? (
                        <span className="text-slate-400">Kayıt Yok</span>
                      ) : row.net > 0 ? (
                        <span className="text-emerald-700">Kârda</span>
                      ) : row.net < 0 ? (
                        <span className="text-rose-700">Zararda</span>
                      ) : (
                        <span className="text-slate-600">Başabaş</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onOpenMonthReport(row.monthKey)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F1D36] hover:text-emerald-700 underline underline-offset-4 cursor-pointer"
                      >
                        <span>Raporu Aç</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-[#F8FAFC] font-semibold text-sm text-[#0F1D36]">
                <td className="py-3 px-4">
                  {selectedYear} Yıllık Toplam ({selectedBranch === 'all' ? 'Konsolide' : selectedBranch})
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                  {annualTotals.count}
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">
                  {formatTRY(annualTotals.income)}
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-rose-700">
                  {formatTRY(annualTotals.expense)}
                </td>
                <td
                  className={`py-3 px-4 text-right font-mono tabular-nums ${
                    annualTotals.net >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {formatTRY(annualTotals.net, true)}
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                  {formatPercent(annualTotals.margin)}
                </td>
                <td colSpan={2} className="py-3 px-4 text-xs text-slate-600">
                  {annualTotals.net >= 0 ? 'Yıllık Net Kâr' : 'Yıllık Net Zarar'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
};
