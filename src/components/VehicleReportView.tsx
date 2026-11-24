import React, { useMemo, useState } from 'react';
import { Car, Download, Plus, Printer } from 'lucide-react';
import { BRANCHES, Branch, Transaction } from '../types/finance';
import {
  calculateVehicleSummaries,
  downloadVehicleReportCSV,
  formatDateTR,
  formatMonthLabel,
  formatPercent,
  formatTRY,
  getAvailableMonths,
  getDetectedVehiclePlates,
  getMonthKey,
  getTransactionVehicleInfo,
} from '../utils/finance';
import { VehicleBreakdownCanvas } from './ReportCanvases';

interface VehicleReportViewProps {
  transactions: Transaction[];
  selectedBranch: 'all' | Branch;
  onSelectBranch: (branch: 'all' | Branch) => void;
  onAddVehicleExpense: (plate?: string) => void;
}

export const VehicleReportView: React.FC<VehicleReportViewProps> = ({
  transactions,
  selectedBranch,
  onSelectBranch,
  onAddVehicleExpense,
}) => {
  const [selectedPlate, setSelectedPlate] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  const availableMonths = useMemo(
    () => getAvailableMonths(transactions, '2026-11'),
    [transactions]
  );

  const plates = useMemo(
    () => getDetectedVehiclePlates(transactions),
    [transactions]
  );

  const scopedExpenses = useMemo(() => {
    return transactions
      .filter((tx) => {
        if (!getTransactionVehicleInfo(tx)) return false;
        if (selectedBranch !== 'all' && tx.branch !== selectedBranch) return false;
        if (selectedMonth !== 'all' && getMonthKey(tx.date) !== selectedMonth) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, selectedBranch, selectedMonth]);

  const plateSummaries = useMemo(
    () => calculateVehicleSummaries(scopedExpenses, plates),
    [scopedExpenses, plates]
  );

  const visibleTransactions = useMemo(() => {
    if (selectedPlate === 'all') return scopedExpenses;
    return scopedExpenses.filter(
      (tx) => getTransactionVehicleInfo(tx)?.plate === selectedPlate
    );
  }, [scopedExpenses, selectedPlate]);

  const totals = useMemo(() => {
    let total = 0;
    let fuel = 0;
    let maintenance = 0;
    let insurance = 0;
    let tolls = 0;
    for (const tx of visibleTransactions) {
      total += tx.amount;
      const subtype = (getTransactionVehicleInfo(tx)?.expenseType ?? '').toLocaleLowerCase('tr-TR');
      if (subtype.includes('yakıt')) fuel += tx.amount;
      else if (subtype.includes('bakım') || subtype.includes('onarım')) maintenance += tx.amount;
      else if (subtype.includes('sigorta') || subtype.includes('muayene') || subtype.includes('vergi'))
        insurance += tx.amount;
      else tolls += tx.amount;
    }
    return {
      total,
      count: visibleTransactions.length,
      fuel,
      maintenance,
      insurance,
      tolls,
    };
  }, [visibleTransactions]);

  const canvasData = useMemo(() => {
    return plateSummaries.map((summary) => {
      let fuel = 0;
      let maintenance = 0;
      let insurance = 0;
      let tolls = 0;
      let other = 0;

      for (const s of summary.subtypes) {
        const key = s.category.toLocaleLowerCase('tr-TR');
        if (key.includes('yakıt')) fuel += s.total;
        else if (key.includes('bakım') || key.includes('onarım')) maintenance += s.total;
        else if (key.includes('sigorta') || key.includes('muayene') || key.includes('vergi'))
          insurance += s.total;
        else if (key.includes('hgs') || key.includes('otopark')) tolls += s.total;
        else other += s.total;
      }

      return {
        plate: summary.plate,
        total: summary.total,
        fuel,
        maintenance,
        insurance,
        tolls,
        other,
      };
    });
  }, [plateSummaries]);

  const scopeLabel = [
    selectedPlate === 'all' ? 'Tüm Araçlar' : selectedPlate,
    selectedBranch === 'all' ? 'Tüm Şubeler' : `${selectedBranch} Şubesi`,
    selectedMonth === 'all' ? 'Tüm Aylar' : formatMonthLabel(selectedMonth),
  ].join(' · ');

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Print-only formal letterhead */}
      <div className="hidden print-only border-b-2 border-[#0F1D36] pb-4 mb-4">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#0F1D36]">
              Yüksel Elektronik · Plaka Bazlı Araç Gider Raporu
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Kapsam: {scopeLabel} · {totals.count} İşlem
            </p>
          </div>
          <p className="text-xs font-mono text-slate-500">Rapor Tarihi: 24.11.2026</p>
        </div>
      </div>

      {/* Plate Switcher + Period & Branch Filter Bar */}
      <section className="no-print bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Quick Plate Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Araç Plakası Seçimi"
              className="inline-flex flex-wrap items-center p-1 bg-slate-100 rounded-lg border border-slate-200 gap-0.5"
            >
              <button
                type="button"
                onClick={() => setSelectedPlate('all')}
                className={`px-3 py-1.5 sm:py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedPlate === 'all'
                    ? 'bg-[#0F1D36] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tüm Araçlar ({plates.length})
              </button>
              {plates.map((plate) => (
                <button
                  key={plate}
                  type="button"
                  onClick={() => setSelectedPlate(plate)}
                  className={`px-3 py-1.5 sm:py-1 text-xs font-mono font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedPlate === plate
                      ? 'bg-[#0F1D36] text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {plate}
                </button>
              ))}
            </div>

            <select
              aria-label="Dönem Seçimi"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-9 px-3 text-xs sm:text-sm font-medium bg-white border border-slate-200 rounded-lg text-[#0F1D36] focus:outline-none focus:ring-2 focus:ring-[#0F1D36]/15"
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
                  className={`px-2.5 sm:px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedBranch === b
                      ? 'bg-[#0F1D36] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {b === 'all' ? 'Tüm Şubeler' : b}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                onAddVehicleExpense(selectedPlate === 'all' ? plates[0] : selectedPlate)
              }
              className="flex-1 sm:flex-initial h-9 px-3.5 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Araç Gideri Ekle</span>
            </button>

            <button
              type="button"
              onClick={() => downloadVehicleReportCSV(visibleTransactions, scopeLabel)}
              disabled={visibleTransactions.length === 0}
              className="h-9 px-3 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="h-9 px-3.5 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-[#0F1D36] rounded-lg hover:bg-[#172b4d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Yazdır / PDF</span>
              <span className="sm:hidden">Yazdır</span>
            </button>
          </div>
        </div>
      </section>

      {/* Executive 4-KPI Strip (2x2 on mobile, 4x1 on desktop) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden print-break-inside-avoid">
        <div className="bg-white p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500 truncate">
            Toplam · {selectedPlate === 'all' ? 'Tüm Araçlar' : selectedPlate}
          </p>
          <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-semibold font-mono tabular-nums text-rose-700">
            {formatTRY(totals.total)}
          </p>
          <p className="mt-1 text-[11px] sm:text-xs text-slate-500 tabular-nums">
            {totals.count} araç harcaması
          </p>
        </div>

        <div className="bg-white p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500">Yakıt Gideri</p>
          <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-semibold font-mono tabular-nums text-[#0F1D36]">
            {formatTRY(totals.fuel)}
          </p>
          <p className="mt-1 text-[11px] sm:text-xs text-slate-500 tabular-nums">
            Pay:{' '}
            {totals.total > 0 ? formatPercent((totals.fuel / totals.total) * 100) : '—'}
          </p>
        </div>

        <div className="bg-white p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500">Bakım / Onarım</p>
          <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-semibold font-mono tabular-nums text-amber-700">
            {formatTRY(totals.maintenance)}
          </p>
          <p className="mt-1 text-[11px] sm:text-xs text-slate-500 tabular-nums">
            Pay:{' '}
            {totals.total > 0
              ? formatPercent((totals.maintenance / totals.total) * 100)
              : '—'}
          </p>
        </div>

        <div className="bg-white p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500 truncate">
            Sigorta / Vergi / HGS
          </p>
          <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-semibold font-mono tabular-nums text-slate-800">
            {formatTRY(totals.insurance + totals.tolls)}
          </p>
          <p className="mt-1 text-[11px] sm:text-xs text-slate-500 tabular-nums truncate">
            Sigorta {formatTRY(totals.insurance)} · HGS {formatTRY(totals.tolls)}
          </p>
        </div>
      </section>

      {/* Plate Cards + @canvas Comparison */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 print-break-inside-avoid">
        {/* Per-Plate Breakdown Cards */}
        <div className="lg:col-span-5 space-y-4">
          {plateSummaries
            .filter((p) => selectedPlate === 'all' || p.plate === selectedPlate)
            .map((plateItem) => {
              const isFocused = selectedPlate === plateItem.plate;
              return (
                <div
                  key={plateItem.plate}
                  className={`bg-white border rounded-xl overflow-hidden transition-colors ${
                    isFocused ? 'border-[#0F1D36]' : 'border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPlate(isFocused ? 'all' : plateItem.plate)
                    }
                    className="w-full px-4 sm:px-5 py-3.5 bg-[#F8FAFC] border-b border-slate-200 flex items-center justify-between gap-3 text-left hover:bg-slate-100/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Car className="w-4 h-4 text-[#0F1D36] shrink-0" />
                      <div>
                        <p className="text-sm font-bold font-mono text-[#0F1D36]">
                          {plateItem.plate}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {plateItem.count} işlem · Filo Payı {formatPercent(plateItem.share)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold font-mono tabular-nums text-rose-700">
                        {formatTRY(plateItem.total)}
                      </p>
                      <p className="text-[11px] font-medium text-[#0F1D36]">
                        {isFocused ? 'Tümünü göster' : 'Plakaya odaklan'}
                      </p>
                    </div>
                  </button>

                  <div className="p-4 sm:px-5 space-y-2.5">
                    {plateItem.subtypes.length === 0 ? (
                      <p className="text-xs text-slate-500 py-1">
                        Seçili dönemde bu plaka için gider kaydı yok.
                      </p>
                    ) : (
                      plateItem.subtypes.map((sub) => (
                        <div key={sub.category} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-700">
                              {sub.category}{' '}
                              <span className="text-slate-400">({sub.count})</span>
                            </span>
                            <span className="font-mono tabular-nums font-semibold text-slate-900">
                              {formatTRY(sub.total)}{' '}
                              <span className="text-slate-400 font-normal">
                                ({formatPercent(sub.percentage)})
                              </span>
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#0F1D36] rounded-full"
                              style={{ width: `${Math.min(100, sub.percentage)}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* @canvas Plate Expense Comparison */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#0F1D36]">
              Plaka Bazlı Gider Dağılımı (@canvas)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Plaka çubuklarına dokunarak ilgili aracın harcamalarını filtreleyebilirsiniz.
            </p>
          </div>

          <VehicleBreakdownCanvas
            summaries={canvasData}
            selectedPlate={selectedPlate}
            onSelectPlate={setSelectedPlate}
            height={230}
          />
        </div>
      </section>

      {/* Vehicle Expense Ledger */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 bg-[#F8FAFC] flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#0F1D36]">
              Araç Harcama Hareketleri ({visibleTransactions.length} Kayıt)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{scopeLabel}</p>
          </div>
          <span className="text-sm font-mono tabular-nums font-semibold text-rose-700 whitespace-nowrap">
            {formatTRY(totals.total)}
          </span>
        </div>

        {visibleTransactions.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-semibold text-[#0F1D36]">
              Seçili filtreye uygun araç gideri bulunamadı
            </p>
            <p className="mt-1.5 text-xs text-slate-500 max-w-md mx-auto">
              Gider kaydı girerken plaka kutucuğuna araç plakasını (ör. 06 GE 3789) yazdığınızda rapor burada otomatik oluşur.
            </p>
            <button
              type="button"
              onClick={() =>
                onAddVehicleExpense(selectedPlate === 'all' ? plates[0] : selectedPlate)
              }
              className="mt-4 h-9 px-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0F1D36] rounded-lg hover:bg-[#172b4d] transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>İlk Araç Giderini Ekle</span>
            </button>
          </div>
        ) : (
          <>
            {/* Mobile App List */}
            <div className="md:hidden divide-y divide-slate-100">
              {visibleTransactions.map((tx) => {
                const info = getTransactionVehicleInfo(tx);
                return (
                  <div key={tx.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#0F1D36]">
                        <span className="font-mono">{info?.plate ?? '—'}</span>
                        {' · '}
                        <span className="font-medium text-slate-700">
                          {info?.expenseType ?? tx.category}
                        </span>
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {tx.description}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        <span className="font-mono tabular-nums">{formatDateTR(tx.date)}</span>
                        {' · '}
                        {tx.branch}
                      </p>
                    </div>
                    <span className="text-sm font-mono tabular-nums font-semibold text-rose-700 whitespace-nowrap shrink-0">
                      {formatTRY(tx.amount)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-5 whitespace-nowrap">Tarih</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">Plaka</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">Masraf Türü</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">Şube</th>
                    <th className="py-2.5 px-4">Açıklama</th>
                    <th className="py-2.5 px-5 text-right whitespace-nowrap">Tutar (₺)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {visibleTransactions.map((tx) => {
                    const info = getTransactionVehicleInfo(tx);
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-5 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                          {formatDateTR(tx.date)}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-semibold text-[#0F1D36] whitespace-nowrap">
                          {info?.plate ?? '—'}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-800 whitespace-nowrap">
                          {info?.expenseType ?? tx.category}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                          {tx.branch}
                        </td>
                        <td className="py-2.5 px-4 text-slate-900">
                          {tx.description}
                        </td>
                        <td className="py-2.5 px-5 text-right font-mono tabular-nums font-semibold text-rose-700 whitespace-nowrap">
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
    </div>
  );
};
