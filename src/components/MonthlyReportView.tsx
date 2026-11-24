import React, { useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Phone,
  Plus,
  Printer,
} from 'lucide-react';
import { BRANCHES, Branch, Transaction } from '../types/finance';
import {
  calculateBranchBreakdown,
  calculateMonthlyPnL,
  calculateRemainingWarranty,
  downloadMonthlyReportCSV,
  formatDateTR,
  formatMonthLabel,
  formatPercent,
  formatTRY,
  getAvailableMonths,
  getMonthKey,
  getNextMonthKey,
  getPreviousMonthKey,
  getTrailingMonths,
  toTelHref,
} from '../utils/finance';
import { DailyCumulativeCanvas, MonthlyComparisonCanvas } from './ReportCanvases';

interface MonthlyReportViewProps {
  transactions: Transaction[];
  reportMonth: string; // YYYY-MM
  onChangeReportMonth: (monthKey: string) => void;
  selectedBranch: 'all' | Branch;
  onSelectBranch: (branch: 'all' | Branch) => void;
  onOpenCustomersReport: () => void;
  onAddNewClick: () => void;
}

export const MonthlyReportView: React.FC<MonthlyReportViewProps> = ({
  transactions,
  reportMonth,
  onChangeReportMonth,
  selectedBranch,
  onSelectBranch,
  onOpenCustomersReport,
  onAddNewClick,
}) => {
  const availableMonths = useMemo(
    () => getAvailableMonths(transactions, reportMonth),
    [transactions, reportMonth]
  );

  const currentSummary = useMemo(
    () => calculateMonthlyPnL(transactions, reportMonth, selectedBranch),
    [transactions, reportMonth, selectedBranch]
  );

  const prevMonthKey = getPreviousMonthKey(reportMonth);
  const prevSummary = useMemo(
    () => calculateMonthlyPnL(transactions, prevMonthKey, selectedBranch),
    [transactions, prevMonthKey, selectedBranch]
  );

  const branchBreakdown = useMemo(
    () => calculateBranchBreakdown(transactions, reportMonth),
    [transactions, reportMonth]
  );

  const trailingSixMonths = useMemo(() => {
    const keys = getTrailingMonths(reportMonth, 6);
    return keys.map((mk) => calculateMonthlyPnL(transactions, mk, selectedBranch));
  }, [transactions, reportMonth, selectedBranch]);

  const monthTransactions = useMemo(
    () =>
      transactions
        .filter(
          (tx) =>
            getMonthKey(tx.date) === reportMonth &&
            (selectedBranch === 'all' || tx.branch === selectedBranch)
        )
        .sort((a, b) => a.date.localeCompare(b.date)),
    [transactions, reportMonth, selectedBranch]
  );

  const monthIncomeCustomers = useMemo(
    () => monthTransactions.filter((t) => t.type === 'income'),
    [monthTransactions]
  );

  const dailyCurve = useMemo(() => {
    const [yearStr, monthStr] = reportMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const daysInMonth =
      !Number.isNaN(year) && !Number.isNaN(month)
        ? new Date(year, month, 0).getDate()
        : 30;

    const dailyNet = new Array<number>(daysInMonth).fill(0);
    for (const tx of monthTransactions) {
      const day = Number(tx.date.slice(8, 10));
      if (day >= 1 && day <= daysInMonth) {
        dailyNet[day - 1] += tx.type === 'income' ? tx.amount : -tx.amount;
      }
    }

    const points: { day: number; cumulative: number }[] = [];
    let running = 0;
    for (let d = 1; d <= daysInMonth; d += 1) {
      running += dailyNet[d - 1];
      points.push({ day: d, cumulative: running });
    }
    return points;
  }, [monthTransactions, reportMonth]);

  const incomeDeltaPct =
    prevSummary.income > 0
      ? ((currentSummary.income - prevSummary.income) / prevSummary.income) * 100
      : null;
  const expenseDeltaPct =
    prevSummary.expense > 0
      ? ((currentSummary.expense - prevSummary.expense) / prevSummary.expense) * 100
      : null;
  const netDeltaAmount = currentSummary.net - prevSummary.net;

  const scopeLabel =
    selectedBranch === 'all'
      ? 'Tüm Şubeler (Konsolide)'
      : `${selectedBranch} Şubesi`;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Print-only formal letterhead */}
      <div className="hidden print-only border-b-2 border-[#0F1D36] pb-4 mb-4">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#0F1D36]">
              Yüksel Elektronik · Aylık Kâr / Zarar Raporu
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Dönem: {currentSummary.label} · Kapsam: {scopeLabel} · İşlem Sayısı:{' '}
              {currentSummary.transactionCount}
            </p>
          </div>
          <p className="text-xs font-mono text-slate-500">
            Rapor Tarihi: 24.11.2026
          </p>
        </div>
      </div>

      {/* Period Switcher, Branch Scope & Export Controls */}
      <section className="no-print bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-start">
            <button
              type="button"
              onClick={() => onChangeReportMonth(getPreviousMonthKey(reportMonth))}
              aria-label="Önceki Ay"
              className="h-9 w-9 inline-flex items-center justify-center border border-slate-200 rounded-lg text-slate-600 hover:text-[#0F1D36] hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <select
              aria-label="Rapor Dönemi"
              value={reportMonth}
              onChange={(e) => onChangeReportMonth(e.target.value)}
              className="flex-1 sm:flex-initial h-9 px-3 text-sm font-semibold bg-white border border-slate-200 rounded-lg text-[#0F1D36] focus:outline-none focus:ring-2 focus:ring-[#0F1D36]/15"
            >
              {availableMonths.map((mk) => (
                <option key={mk} value={mk}>
                  {formatMonthLabel(mk)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => onChangeReportMonth(getNextMonthKey(reportMonth))}
              aria-label="Sonraki Ay"
              className="h-9 w-9 inline-flex items-center justify-center border border-slate-200 rounded-lg text-slate-600 hover:text-[#0F1D36] hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div
            role="group"
            aria-label="Rapor Şube Kapsamı"
            className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200"
          >
            {(['all', ...BRANCHES] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => onSelectBranch(b)}
                className={`px-2.5 sm:px-3 py-1.5 sm:py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedBranch === b
                    ? 'bg-[#0F1D36] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {b === 'all' ? 'Konsolide' : `${b} Şubesi`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() =>
              downloadMonthlyReportCSV(
                currentSummary,
                scopeLabel,
                selectedBranch === 'all' ? branchBreakdown : undefined
              )
            }
            className="flex-1 sm:flex-initial h-9 px-3.5 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV İndir</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 sm:flex-initial h-9 px-4 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-[#0F1D36] rounded-lg hover:bg-[#172b4d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Yazdır / PDF</span>
          </button>
        </div>
      </section>

      {/* Executive 4-KPI Strip (2x2 compact on mobile, 4x1 on desktop) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden print-break-inside-avoid">
        <div className="bg-white p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500 truncate">
            Gelir · {selectedBranch === 'all' ? 'Konsolide' : selectedBranch}
          </p>
          <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-semibold font-mono tabular-nums text-emerald-700">
            {formatTRY(currentSummary.income)}
          </p>
          <p className="mt-1 text-[11px] sm:text-xs text-slate-500 tabular-nums">
            Önceki ay:{' '}
            <span className="font-medium text-slate-800">
              {incomeDeltaPct === null
                ? 'Veri yok'
                : `${incomeDeltaPct >= 0 ? '+' : ''}${formatPercent(incomeDeltaPct)}`}
            </span>
          </p>
        </div>

        <div className="bg-white p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500 truncate">
            Gider · {selectedBranch === 'all' ? 'Konsolide' : selectedBranch}
          </p>
          <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-semibold font-mono tabular-nums text-rose-700">
            {formatTRY(currentSummary.expense)}
          </p>
          <p className="mt-1 text-[11px] sm:text-xs text-slate-500 tabular-nums">
            Önceki ay:{' '}
            <span className="font-medium text-slate-800">
              {expenseDeltaPct === null
                ? 'Veri yok'
                : `${expenseDeltaPct >= 0 ? '+' : ''}${formatPercent(expenseDeltaPct)}`}
            </span>
          </p>
        </div>

        <div className="bg-white p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500">Net Dönem Sonucu</p>
          <p
            className={`mt-1.5 sm:mt-2 text-lg sm:text-2xl font-semibold font-mono tabular-nums ${
              currentSummary.net > 0
                ? 'text-emerald-700'
                : currentSummary.net < 0
                ? 'text-rose-700'
                : 'text-[#0F1D36]'
            }`}
          >
            {formatTRY(currentSummary.net, true)}
          </p>
          <p className="mt-1 text-[11px] sm:text-xs text-slate-600 tabular-nums truncate">
            {currentSummary.net > 0
              ? 'Net Kâr'
              : currentSummary.net < 0
              ? 'Net Zarar'
              : 'Başabaş'}{' '}
            ·{' '}
            <span className="font-mono font-medium">
              {formatTRY(netDeltaAmount, true)}
            </span>
          </p>
        </div>

        <div className="bg-white p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500">Net Kâr Marjı</p>
          <p
            className={`mt-1.5 sm:mt-2 text-lg sm:text-2xl font-semibold font-mono tabular-nums ${
              currentSummary.margin !== null && currentSummary.margin < 0
                ? 'text-rose-700'
                : 'text-[#0F1D36]'
            }`}
          >
            {formatPercent(currentSummary.margin)}
          </p>
          <p className="mt-1 text-[11px] sm:text-xs text-slate-500 tabular-nums">
            Gider / Gelir:{' '}
            <span className="font-mono font-medium text-slate-800">
              {currentSummary.income > 0
                ? formatPercent((currentSummary.expense / currentSummary.income) * 100)
                : '—'}
            </span>
          </p>
        </div>
      </section>

      {currentSummary.transactionCount === 0 ? (
        <section className="bg-white border border-slate-200 rounded-xl p-10 sm:p-12 text-center">
          <h2 className="text-base font-semibold text-[#0F1D36]">
            {currentSummary.label} · {scopeLabel} için henüz kayıt yok
          </h2>
          <p className="mt-1.5 text-xs text-slate-500 max-w-md mx-auto">
            Bu dönem ve şube için gelir veya gider verisi eklendiğinde aylık kâr/zarar tablosu ve kategori dağılımı otomatik olarak oluşturulur.
          </p>
          <button
            type="button"
            onClick={onAddNewClick}
            className="mt-5 h-9 px-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0F1D36] rounded-lg hover:bg-[#172b4d] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Bu Döneme Kayıt Ekle</span>
          </button>
        </section>
      ) : (
        <>
          {/* Branch Comparison when viewing Consolidated */}
          {selectedBranch === 'all' && (
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden print-break-inside-avoid">
              <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-[#F8FAFC] flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-[#0F1D36]">
                    Şube Bazlı Kâr / Zarar · {currentSummary.label}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Gebze ve Yenidoğan şubelerinin dönem içi kârlılık katkısı
                  </p>
                </div>
                <span className="hidden sm:inline text-xs text-slate-500">
                  Şube detayına geçmek için satıra tıklayın
                </span>
              </div>

              {/* Mobile Branch Cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {branchBreakdown.map((b) => (
                  <button
                    key={b.branch}
                    type="button"
                    onClick={() => onSelectBranch(b.branch)}
                    className="w-full text-left p-4 flex items-center justify-between gap-3 active:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#0F1D36]">
                        {b.branch} Şubesi{' '}
                        <span className="text-xs font-normal text-slate-500">
                          ({b.transactionCount} işlem · Pay {formatPercent(b.incomeShare)})
                        </span>
                      </p>
                      <p className="mt-1 text-xs font-mono tabular-nums text-slate-500">
                        Gelir <span className="text-emerald-700">{formatTRY(b.income)}</span> · Gider{' '}
                        <span className="text-rose-700">{formatTRY(b.expense)}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-mono tabular-nums font-semibold ${
                          b.net > 0
                            ? 'text-emerald-700'
                            : b.net < 0
                            ? 'text-rose-700'
                            : 'text-slate-900'
                        }`}
                      >
                        {formatTRY(b.net, true)}
                      </p>
                      <p className="text-[11px] font-mono tabular-nums text-slate-500">
                        Marj {formatPercent(b.margin)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Desktop Branch Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-6">Şube</th>
                      <th className="py-2.5 px-4 text-right">İşlem</th>
                      <th className="py-2.5 px-4 text-right">Gelir (₺)</th>
                      <th className="py-2.5 px-4 text-right">Gelir Payı</th>
                      <th className="py-2.5 px-4 text-right">Gider (₺)</th>
                      <th className="py-2.5 px-4 text-right">Net Kâr / Zarar (₺)</th>
                      <th className="py-2.5 px-6 text-right">Kâr Marjı</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {branchBreakdown.map((b) => (
                      <tr
                        key={b.branch}
                        onClick={() => onSelectBranch(b.branch)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-6 font-semibold text-[#0F1D36]">
                          {b.branch} Şubesi
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-500">
                          {b.transactionCount}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 font-medium">
                          {formatTRY(b.income)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-600">
                          {formatPercent(b.incomeShare)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-rose-700 font-medium">
                          {formatTRY(-b.expense)}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${
                            b.net > 0
                              ? 'text-emerald-700'
                              : b.net < 0
                              ? 'text-rose-700'
                              : 'text-slate-900'
                          }`}
                        >
                          {formatTRY(b.net, true)}
                        </td>
                        <td className="py-3 px-6 text-right font-mono tabular-nums text-xs text-slate-700">
                          {formatPercent(b.margin)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 2-Column @canvas Charts */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 print-break-inside-avoid">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between">
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-[#0F1D36]">
                  Son 6 Aylık Gelir / Gider ve Net Kâr ({selectedBranch === 'all' ? 'Konsolide' : selectedBranch})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Aylara dokunarak ilgili dönemin raporuna geçebilirsiniz.
                </p>
              </div>

              <MonthlyComparisonCanvas
                months={trailingSixMonths}
                selectedMonthKey={reportMonth}
                onSelectMonth={onChangeReportMonth}
                height={230}
              />
            </div>

            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between">
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-[#0F1D36]">
                  Ay İçi Kümülatif Kâr / Zarar Seyri
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {currentSummary.label} ({selectedBranch === 'all' ? 'Konsolide' : selectedBranch}) günlük birikimli değişim
                </p>
              </div>

              <DailyCumulativeCanvas
                points={dailyCurve}
                monthLabel={currentSummary.label}
                height={230}
              />
            </div>
          </section>

          {/* Formal Itemized P&L Statement */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden print-break-inside-avoid">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 bg-[#F8FAFC] flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-[#0F1D36]">
                  Resmi Kâr / Zarar Tablosu · {currentSummary.label}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {scopeLabel} · Kategori bazlı gelirler, giderler ve net dönem sonucu
                </p>
              </div>
              <span className="hidden sm:inline text-xs font-mono text-slate-500 whitespace-nowrap">
                Para Birimi: TRY (₺)
              </span>
            </div>

            <div className="divide-y divide-slate-200">
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h3 className="text-xs font-bold tracking-wider text-[#0F1D36]">
                    I. GELİRLER
                  </h3>
                  <span className="text-xs font-mono font-semibold text-emerald-700 tabular-nums">
                    {formatTRY(currentSummary.income)}
                  </span>
                </div>

                {currentSummary.incomeCategories.length === 0 ? (
                  <p className="py-4 text-xs text-slate-500">
                    Bu dönemde gelir kaydı bulunmuyor.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {currentSummary.incomeCategories.map((item) => (
                      <div
                        key={item.category}
                        className="py-3 grid grid-cols-12 items-center gap-2 sm:gap-3 text-xs sm:text-sm"
                      >
                        <div className="col-span-6 sm:col-span-4 font-medium text-slate-800 truncate">
                          {item.category}
                          <span className="ml-1.5 text-[11px] font-normal text-slate-400">
                            ({item.count})
                          </span>
                        </div>
                        <div className="col-span-4 hidden sm:block">
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-600 rounded-full"
                              style={{ width: `${Math.min(100, item.percentage)}%` }}
                            />
                          </div>
                        </div>
                        <div className="col-span-2 text-right font-mono tabular-nums text-[11px] sm:text-xs text-slate-500">
                          {formatPercent(item.percentage)}
                        </div>
                        <div className="col-span-4 sm:col-span-2 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {formatTRY(item.total)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h3 className="text-xs font-bold tracking-wider text-[#0F1D36]">
                    II. GİDERLER
                  </h3>
                  <span className="text-xs font-mono font-semibold text-rose-700 tabular-nums">
                    {formatTRY(-currentSummary.expense)}
                  </span>
                </div>

                {currentSummary.expenseCategories.length === 0 ? (
                  <p className="py-4 text-xs text-slate-500">
                    Bu dönemde gider kaydı bulunmuyor.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {currentSummary.expenseCategories.map((item) => (
                      <div
                        key={item.category}
                        className="py-3 grid grid-cols-12 items-center gap-2 sm:gap-3 text-xs sm:text-sm"
                      >
                        <div className="col-span-6 sm:col-span-4 font-medium text-slate-800 truncate">
                          {item.category}
                          <span className="ml-1.5 text-[11px] font-normal text-slate-400">
                            ({item.count})
                          </span>
                        </div>
                        <div className="col-span-4 hidden sm:block">
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-rose-600 rounded-full"
                              style={{ width: `${Math.min(100, item.percentage)}%` }}
                            />
                          </div>
                        </div>
                        <div className="col-span-2 text-right font-mono tabular-nums text-[11px] sm:text-xs text-slate-500">
                          {formatPercent(item.percentage)}
                        </div>
                        <div className="col-span-4 sm:col-span-2 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {formatTRY(-item.total)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-6 bg-[#F8FAFC]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-[#0F1D36]">
                      III. DÖNEM NET KÂR / ZARARI (I − II)
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
                      Gelir ({formatTRY(currentSummary.income)}) − Gider (
                      {formatTRY(currentSummary.expense)}) · Marj:{' '}
                      <span className="font-mono font-semibold">
                        {formatPercent(currentSummary.margin)}
                      </span>
                    </p>
                  </div>
                  <div className="text-right ml-auto">
                    <p
                      className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${
                        currentSummary.net > 0
                          ? 'text-emerald-700'
                          : currentSummary.net < 0
                          ? 'text-rose-700'
                          : 'text-[#0F1D36]'
                      }`}
                    >
                      {formatTRY(currentSummary.net, true)}
                    </p>
                    <p className="text-xs font-semibold text-slate-600 mt-0.5">
                      {currentSummary.net > 0
                        ? 'Net Dönem Kârı'
                        : currentSummary.net < 0
                        ? 'Net Dönem Zararı'
                        : 'Başabaş'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Month Customer List (Consistent Garanti Bitiş, clickable tel: links, mobile cards) */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden print-break-inside-avoid">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#0F1D36]">
                  Dönem Müşteri Listesi ({monthIncomeCustomers.length} Gelir İşlemi)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {currentSummary.label} · Müşteri / firma adı, telefon ve garanti bitiş tarihi
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenCustomersReport}
                className="no-print text-xs font-semibold text-[#0F1D36] hover:text-emerald-700 underline underline-offset-4 cursor-pointer"
              >
                Tüm Müşteri Listesini Aç
              </button>
            </div>

            {monthIncomeCustomers.length === 0 ? (
              <p className="px-6 py-6 text-xs text-slate-500">
                Bu dönemde müşteri / gelir kaydı bulunmuyor.
              </p>
            ) : (
              <>
                {/* Mobile Customer Cards */}
                <div className="md:hidden divide-y divide-slate-100">
                  {monthIncomeCustomers.map((tx) => {
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
                            <p className="text-sm font-semibold text-[#0F1D36] truncate">
                              {tx.customerName || (
                                <span className="font-normal text-slate-400">
                                  Belirtilmedi
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

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                          {tx.customerPhone ? (
                            <a
                              href={toTelHref(tx.customerPhone)}
                              className="inline-flex items-center gap-1.5 min-h-[36px] text-xs font-mono tabular-nums font-semibold text-[#0F1D36] hover:text-emerald-700 underline underline-offset-4"
                            >
                              <Phone className="w-3.5 h-3.5 shrink-0 text-emerald-700" />
                              <span>{tx.customerPhone}</span>
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">Telefon yok</span>
                          )}
                          <div className="text-xs">
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

                {/* Desktop Customer Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-slate-600">
                        <th className="py-2.5 px-6">Müşteri / Firma Adı</th>
                        <th className="py-2.5 px-4">Telefon</th>
                        <th className="py-2.5 px-4">Garanti Bitiş</th>
                        <th className="py-2.5 px-4">Şube</th>
                        <th className="py-2.5 px-4">Tarih</th>
                        <th className="py-2.5 px-4">Açıklama</th>
                        <th className="py-2.5 px-6 text-right">Tutar (₺)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {monthIncomeCustomers.map((tx) => {
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
                          <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-6 font-semibold text-[#0F1D36] whitespace-nowrap">
                              {tx.customerName || (
                                <span className="font-normal text-slate-400">Belirtilmedi</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 font-mono tabular-nums whitespace-nowrap">
                              {tx.customerPhone ? (
                                <a
                                  href={toTelHref(tx.customerPhone)}
                                  className="inline-flex items-center gap-1 font-medium text-[#0F1D36] hover:text-emerald-700 underline underline-offset-4"
                                >
                                  <Phone className="w-3 h-3 shrink-0 text-slate-400" />
                                  <span>{tx.customerPhone}</span>
                                </a>
                              ) : (
                                <span className="font-sans text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 font-mono tabular-nums whitespace-nowrap">
                              <span className={endDateColor}>{endDateDisplay}</span>
                            </td>
                            <td className="py-2.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                              {tx.branch}
                            </td>
                            <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                              {formatDateTR(tx.date)}
                            </td>
                            <td className="py-2.5 px-4 text-slate-700">
                              {tx.description}
                            </td>
                            <td className="py-2.5 px-6 text-right font-mono tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                              {formatTRY(tx.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          {/* Month Detailed Ledger Extract */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 bg-[#F8FAFC] flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#0F1D36]">
                Dönem Hareket Dökümü ({monthTransactions.length} İşlem)
              </h2>
              <span className="text-xs text-slate-500 truncate">
                {currentSummary.label} · {scopeLabel}
              </span>
            </div>

            {/* Mobile Ledger List */}
            <div className="md:hidden divide-y divide-slate-100">
              {monthTransactions.map((tx) => (
                <div key={tx.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500">
                      <span className="font-mono tabular-nums">{formatDateTR(tx.date)}</span>
                      {' · '}
                      <span className="font-semibold text-[#0F1D36]">{tx.branch}</span>
                      {' · '}
                      <span>{tx.category}</span>
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {tx.description}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-mono tabular-nums font-semibold whitespace-nowrap shrink-0 ${
                      tx.type === 'income' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {tx.type === 'income'
                      ? formatTRY(tx.amount, true)
                      : formatTRY(-tx.amount)}
                  </span>
                </div>
              ))}
            </div>

            {/* Desktop Ledger Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Tarih</th>
                    <th className="py-2.5 px-4">Şube</th>
                    <th className="py-2.5 px-4">Tür</th>
                    <th className="py-2.5 px-4">Kategori</th>
                    <th className="py-2.5 px-4">Açıklama</th>
                    <th className="py-2.5 px-4 text-right">Tutar (₺)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {monthTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {formatDateTR(tx.date)}
                      </td>
                      <td className="py-2 px-4 font-semibold text-[#0F1D36] whitespace-nowrap">
                        {tx.branch}
                      </td>
                      <td
                        className={`py-2 px-4 font-semibold whitespace-nowrap ${
                          tx.type === 'income' ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {tx.type === 'income' ? 'Gelir' : 'Gider'}
                      </td>
                      <td className="py-2 px-4 text-slate-700 whitespace-nowrap">
                        {tx.category}
                      </td>
                      <td className="py-2 px-4 text-slate-900">
                        {tx.description}
                        {tx.documentNo && (
                          <span className="ml-1.5 font-mono text-slate-400">
                            · {tx.documentNo}
                          </span>
                        )}
                      </td>
                      <td
                        className={`py-2 px-4 text-right font-mono tabular-nums font-medium whitespace-nowrap ${
                          tx.type === 'income' ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {tx.type === 'income'
                          ? formatTRY(tx.amount, true)
                          : formatTRY(-tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
