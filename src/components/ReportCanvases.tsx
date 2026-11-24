import React, { useEffect, useRef, useState } from 'react';
import { MonthlyPnLSummary } from '../types/finance';
import { formatCompactTRY, formatTRY, TURKISH_MONTHS } from '../utils/finance';

interface MonthlyComparisonCanvasProps {
  months: MonthlyPnLSummary[];
  selectedMonthKey: string;
  onSelectMonth: (monthKey: string) => void;
  height?: number;
}

function shortMonthLabel(mk: string): string {
  const [y, m] = mk.split('-');
  const idx = Number(m) - 1;
  return `${TURKISH_MONTHS[idx]?.slice(0, 3) ?? m} '${y.slice(2)}`;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (h <= 0 || w <= 0) return;
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

export const MonthlyComparisonCanvas: React.FC<MonthlyComparisonCanvasProps> = ({
  months,
  selectedMonthKey,
  onSelectMonth,
  height = 240,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [width, setWidth] = useState<number>(600);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const nextW = el.clientWidth;
      if (nextW > 0) setWidth(nextW);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || months.length === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const padL = width < 420 ? 44 : 56;
    const padR = 14;
    const padT = 18;
    const padB = 30;
    const plotW = Math.max(120, width - padL - padR);
    const plotH = Math.max(80, height - padT - padB);

    let maxVal = 10000;
    for (const m of months) {
      if (m.income > maxVal) maxVal = m.income;
      if (m.expense > maxVal) maxVal = m.expense;
    }
    maxVal *= 1.15;

    // Horizontal gridlines & Y-axis labels
    ctx.font = '500 10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const steps = 4;
    for (let i = 0; i <= steps; i += 1) {
      const ratio = i / steps;
      const y = padT + plotH - ratio * plotH;
      ctx.strokeStyle = i === 0 ? '#cbd5e1' : '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.setLineDash(i === 0 ? [] : [3, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(width - padR, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.fillText(formatCompactTRY(maxVal * ratio), padL - 8, y);
    }
    ctx.setLineDash([]);

    const count = months.length;
    const groupW = plotW / count;
    const barW = Math.max(6, Math.min(22, groupW * 0.28));
    const barGap = Math.max(2, Math.min(6, groupW * 0.07));

    // Bars
    months.forEach((item, idx) => {
      const groupX = padL + idx * groupW;
      const centerX = groupX + groupW / 2;
      const isSelected = item.monthKey === selectedMonthKey;
      const isHovered = hoveredIdx === idx;

      if (isSelected || isHovered) {
        ctx.fillStyle = isSelected ? 'rgba(15, 29, 54, 0.05)' : 'rgba(148, 163, 184, 0.08)';
        drawRoundedRect(ctx, groupX + 3, padT - 4, groupW - 6, plotH + 8, 6);
      }

      const incH = (item.income / maxVal) * plotH;
      const expH = (item.expense / maxVal) * plotH;

      // Income bar
      ctx.fillStyle = isSelected || isHovered ? '#047857' : '#10b981';
      if (item.income > 0) {
        drawRoundedRect(
          ctx,
          centerX - barW - barGap / 2,
          padT + plotH - Math.max(3, incH),
          barW,
          Math.max(3, incH),
          3
        );
      }

      // Expense bar
      ctx.fillStyle = isSelected || isHovered ? '#be123c' : '#f43f5e';
      if (item.expense > 0) {
        drawRoundedRect(
          ctx,
          centerX + barGap / 2,
          padT + plotH - Math.max(3, expH),
          barW,
          Math.max(3, expH),
          3
        );
      }

      // Month label
      ctx.font = isSelected
        ? '600 10.5px "DM Sans", sans-serif'
        : '500 10px "DM Sans", sans-serif';
      ctx.fillStyle = isSelected ? '#0F1D36' : '#64748b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const label =
        count > 8 ? TURKISH_MONTHS[idx]?.slice(0, 3) ?? '' : shortMonthLabel(item.monthKey);
      ctx.fillText(label, centerX, padT + plotH + 9);
    });

    // Net Profit overlay curve when <= 12 bars
    ctx.strokeStyle = '#0F1D36';
    ctx.lineWidth = 2;
    ctx.beginPath();
    months.forEach((item, idx) => {
      const centerX = padL + idx * groupW + groupW / 2;
      const clampedNet = Math.max(0, item.net);
      const y = padT + plotH - (clampedNet / maxVal) * plotH;
      if (idx === 0) ctx.moveTo(centerX, y);
      else ctx.lineTo(centerX, y);
    });
    ctx.stroke();

    months.forEach((item, idx) => {
      const centerX = padL + idx * groupW + groupW / 2;
      const clampedNet = Math.max(0, item.net);
      const y = padT + plotH - (clampedNet / maxVal) * plotH;
      ctx.fillStyle = item.net >= 0 ? '#0F1D36' : '#be123c';
      ctx.beginPath();
      ctx.arc(centerX, y, hoveredIdx === idx || item.monthKey === selectedMonthKey ? 4 : 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }, [months, selectedMonthKey, width, height, hoveredIdx]);

  const getIndexFromPointer = (clientX: number): number | null => {
    const canvas = canvasRef.current;
    if (!canvas || months.length === 0) return null;
    const rect = canvas.getBoundingClientRect();
    const padL = width < 420 ? 44 : 56;
    const padR = 14;
    const plotW = Math.max(120, width - padL - padR);
    const x = clientX - rect.left - padL;
    if (x < 0 || x > plotW) return null;
    const idx = Math.floor((x / plotW) * months.length);
    return idx >= 0 && idx < months.length ? idx : null;
  };

  const activeItem =
    hoveredIdx !== null
      ? months[hoveredIdx]
      : months.find((m) => m.monthKey === selectedMonthKey) ?? months[months.length - 1];

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="relative w-full">
        <canvas
          ref={canvasRef}
          onPointerMove={(e) => setHoveredIdx(getIndexFromPointer(e.clientX))}
          onPointerLeave={() => setHoveredIdx(null)}
          onClick={(e) => {
            const idx = getIndexFromPointer(e.clientX);
            if (idx !== null && months[idx]) {
              onSelectMonth(months[idx].monthKey);
            }
          }}
          className="block w-full cursor-pointer touch-pan-y"
          aria-label="Aylık Gelir Gider ve Net Kâr Grafiği"
        />
      </div>

      {activeItem && (
        <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3 text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
              <span>Gelir</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
              <span>Gider</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-[#0F1D36] inline-block" />
              <span>Net Kâr</span>
            </span>
          </div>
          <div className="font-mono tabular-nums text-slate-600">
            <span className="font-sans font-semibold text-slate-900 mr-2">
              {activeItem.label}:
            </span>
            <span className="text-emerald-700">{formatTRY(activeItem.income)}</span>
            {' · '}
            <span className="text-rose-700">{formatTRY(activeItem.expense)}</span>
            {' · '}
            <span className={activeItem.net >= 0 ? 'text-[#0F1D36] font-semibold' : 'text-rose-700 font-semibold'}>
              Net {formatTRY(activeItem.net, true)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

interface DailyCumulativeCanvasProps {
  points: { day: number; cumulative: number }[];
  monthLabel: string;
  height?: number;
}

export const DailyCumulativeCanvas: React.FC<DailyCumulativeCanvasProps> = ({
  points,
  monthLabel,
  height = 240,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [width, setWidth] = useState<number>(420);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const nextW = el.clientWidth;
      if (nextW > 0) setWidth(nextW);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const padL = width < 380 ? 44 : 54;
    const padR = 14;
    const padT = 18;
    const padB = 30;
    const plotW = Math.max(100, width - padL - padR);
    const plotH = Math.max(80, height - padT - padB);

    const vals = points.map((p) => p.cumulative);
    const minVal = Math.min(0, ...vals);
    const maxVal = Math.max(0, ...vals);
    const span = Math.max(1000, maxVal - minVal);

    const toY = (v: number) => padT + plotH - ((v - minVal) / span) * plotH;
    const toX = (i: number) =>
      padL + (points.length > 1 ? (i / (points.length - 1)) * plotW : plotW / 2);

    const zeroY = toY(0);

    // Zero baseline
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padL, zeroY);
    ctx.lineTo(width - padR, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Y labels
    ctx.font = '500 10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#64748b';
    ctx.fillText('₺0', padL - 8, zeroY);
    if (maxVal > 0) {
      ctx.fillStyle = '#64748b';
      ctx.fillText(formatCompactTRY(maxVal), padL - 8, padT + 4);
    }
    if (minVal < 0) {
      ctx.fillStyle = '#be123c';
      ctx.fillText(formatCompactTRY(minVal), padL - 8, padT + plotH - 4);
    }

    const lastVal = points[points.length - 1]?.cumulative ?? 0;
    const isPositive = lastVal >= 0;
    const lineColor = isPositive ? '#047857' : '#be123c';

    // Area fill toward zero line
    const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    if (isPositive) {
      grad.addColorStop(0, 'rgba(4, 120, 87, 0.22)');
      grad.addColorStop(1, 'rgba(4, 120, 87, 0.01)');
    } else {
      grad.addColorStop(0, 'rgba(190, 18, 60, 0.02)');
      grad.addColorStop(1, 'rgba(190, 18, 60, 0.22)');
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(toX(0), zeroY);
    points.forEach((pt, i) => {
      ctx.lineTo(toX(i), toY(pt.cumulative));
    });
    ctx.lineTo(toX(points.length - 1), zeroY);
    ctx.closePath();
    ctx.fill();

    // Main curve
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    points.forEach((pt, i) => {
      const x = toX(i);
      const y = toY(pt.cumulative);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // X-axis day markers
    ctx.font = '500 10px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#64748b';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('1. Gün', padL, padT + plotH + 9);
    ctx.textAlign = 'center';
    ctx.fillText('15. Gün', padL + plotW / 2, padT + plotH + 9);
    ctx.textAlign = 'right';
    ctx.fillText(`${points.length}. Gün`, width - padR, padT + plotH + 9);

    // Highlight active point
    const focusIdx = hoveredIdx !== null ? hoveredIdx : points.length - 1;
    const focusPt = points[focusIdx];
    if (focusPt) {
      const fx = toX(focusIdx);
      const fy = toY(focusPt.cumulative);
      if (hoveredIdx !== null) {
        ctx.strokeStyle = 'rgba(15, 29, 54, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(fx, padT);
        ctx.lineTo(fx, padT + plotH);
        ctx.stroke();
      }
      ctx.fillStyle = focusPt.cumulative >= 0 ? '#047857' : '#be123c';
      ctx.beginPath();
      ctx.arc(fx, fy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
  }, [points, width, height, hoveredIdx]);

  const handlePointerMove = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const padL = width < 380 ? 44 : 54;
    const padR = 14;
    const plotW = Math.max(100, width - padL - padR);
    const ratio = (clientX - rect.left - padL) / plotW;
    if (ratio < 0 || ratio > 1) {
      setHoveredIdx(null);
      return;
    }
    const idx = Math.round(ratio * (points.length - 1));
    setHoveredIdx(Math.max(0, Math.min(points.length - 1, idx)));
  };

  const activePoint =
    hoveredIdx !== null ? points[hoveredIdx] : points[points.length - 1];

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="relative w-full">
        <canvas
          ref={canvasRef}
          onPointerMove={(e) => handlePointerMove(e.clientX)}
          onPointerLeave={() => setHoveredIdx(null)}
          className="block w-full cursor-crosshair touch-pan-y"
          aria-label={`${monthLabel} Kümülatif Kâr Zarar Seyri Grafiği`}
        />
      </div>

      {activePoint && (
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-600">
            {hoveredIdx !== null
              ? `${activePoint.day}. Gün Sonu Bakiyesi`
              : 'Dönem Sonu Bakiyesi'}
          </span>
          <span
            className={`font-mono font-semibold tabular-nums ${
              activePoint.cumulative >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatTRY(activePoint.cumulative, true)}
          </span>
        </div>
      )}
    </div>
  );
};

interface VehicleBreakdownCanvasProps {
  summaries: {
    plate: string;
    total: number;
    fuel: number;
    maintenance: number;
    insurance: number;
    tolls: number;
    other: number;
  }[];
  selectedPlate: string;
  onSelectPlate: (plate: string) => void;
  height?: number;
}

export const VehicleBreakdownCanvas: React.FC<VehicleBreakdownCanvasProps> = ({
  summaries,
  selectedPlate,
  onSelectPlate,
  height = 220,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [width, setWidth] = useState<number>(560);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const nextW = el.clientWidth;
      if (nextW > 0) setWidth(nextW);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || summaries.length === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const padL = width < 420 ? 48 : 60;
    const padR = 14;
    const padT = 18;
    const padB = 34;
    const plotW = Math.max(120, width - padL - padR);
    const plotH = Math.max(80, height - padT - padB);

    let maxVal = 5000;
    for (const s of summaries) {
      const peak = Math.max(s.fuel, s.maintenance, s.insurance, s.tolls + s.other);
      if (peak > maxVal) maxVal = peak;
    }
    maxVal *= 1.18;

    ctx.font = '500 10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const steps = 4;
    for (let i = 0; i <= steps; i += 1) {
      const ratio = i / steps;
      const y = padT + plotH - ratio * plotH;
      ctx.strokeStyle = i === 0 ? '#cbd5e1' : '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.setLineDash(i === 0 ? [] : [3, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(width - padR, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.fillText(formatCompactTRY(maxVal * ratio), padL - 8, y);
    }
    ctx.setLineDash([]);

    const groupW = plotW / summaries.length;
    const barW = Math.max(8, Math.min(24, groupW * 0.16));
    const barGap = Math.max(3, Math.min(8, groupW * 0.03));
    const colors = ['#0F1D36', '#d97706', '#be123c', '#047857'];

    summaries.forEach((item, idx) => {
      const groupX = padL + idx * groupW;
      const centerX = groupX + groupW / 2;
      const isSelected = selectedPlate === item.plate;
      const isHovered = hoveredIdx === idx;

      if (isSelected || isHovered) {
        ctx.fillStyle = isSelected ? 'rgba(15, 29, 54, 0.05)' : 'rgba(148, 163, 184, 0.08)';
        drawRoundedRect(ctx, groupX + 6, padT - 4, groupW - 12, plotH + 8, 6);
      }

      const values = [item.fuel, item.maintenance, item.insurance, item.tolls + item.other];
      const totalGroupW = values.length * barW + (values.length - 1) * barGap;
      const startX = centerX - totalGroupW / 2;

      values.forEach((val, vIdx) => {
        if (val <= 0) return;
        const barH = Math.max(3, (val / maxVal) * plotH);
        ctx.fillStyle = colors[vIdx];
        drawRoundedRect(
          ctx,
          startX + vIdx * (barW + barGap),
          padT + plotH - barH,
          barW,
          barH,
          3
        );
      });

      ctx.font = isSelected
        ? '700 11px "IBM Plex Mono", monospace'
        : '600 11px "IBM Plex Mono", monospace';
      ctx.fillStyle = isSelected ? '#0F1D36' : '#334155';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(item.plate, centerX, padT + plotH + 10);
    });
  }, [summaries, selectedPlate, width, height, hoveredIdx]);

  const getIndexFromPointer = (clientX: number): number | null => {
    const canvas = canvasRef.current;
    if (!canvas || summaries.length === 0) return null;
    const rect = canvas.getBoundingClientRect();
    const padL = width < 420 ? 48 : 60;
    const padR = 14;
    const plotW = Math.max(120, width - padL - padR);
    const x = clientX - rect.left - padL;
    if (x < 0 || x > plotW) return null;
    const idx = Math.floor((x / plotW) * summaries.length);
    return idx >= 0 && idx < summaries.length ? idx : null;
  };

  const activeItem =
    hoveredIdx !== null
      ? summaries[hoveredIdx]
      : summaries.find((s) => s.plate === selectedPlate) ?? summaries[0];

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="relative w-full">
        <canvas
          ref={canvasRef}
          onPointerMove={(e) => setHoveredIdx(getIndexFromPointer(e.clientX))}
          onPointerLeave={() => setHoveredIdx(null)}
          onClick={(e) => {
            const idx = getIndexFromPointer(e.clientX);
            if (idx !== null && summaries[idx]) {
              onSelectPlate(
                selectedPlate === summaries[idx].plate ? 'all' : summaries[idx].plate
              );
            }
          }}
          className="block w-full cursor-pointer touch-pan-y"
          aria-label="Plaka Bazlı Araç Gider Karşılaştırma Grafiği"
        />
      </div>

      {activeItem && (
        <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#0F1D36] inline-block" />
              <span>Yakıt</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-600 inline-block" />
              <span>Bakım</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-700 inline-block" />
              <span>Sigorta/Vergi</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-700 inline-block" />
              <span>HGS/Otopark</span>
            </span>
          </div>
          <div className="font-mono tabular-nums text-slate-700">
            <span className="font-semibold text-[#0F1D36] mr-2">{activeItem.plate}:</span>
            <span className="font-semibold text-rose-700">{formatTRY(activeItem.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
