// Chart.js の折れ線グラフ。横軸は日時（ミリ秒）。注意範囲の帯と換水の目印を自前のプラグインで描く
import {
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartDataset,
  type Plugin,
  type TooltipItem,
  type PointStyle,
} from 'chart.js';
import { useEffect, useRef } from 'react';
import { fmtDateTime } from '../lib/date';

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip, Legend);

export type Series = {
  label: string;
  color: string;
  points: { x: number; y: number }[];
  pointColors?: string[]; // 点ごとの色（範囲外を赤にするなど）
  pointStyle?: PointStyle; // 色が見分けにくい人のために形でも区別する
  dash?: number[];
};

type Props = {
  series: Series[];
  band?: { min?: number; max?: number };
  markers?: number[]; // 縦の点線を引く日時（換水など）
  xMin?: number;
  xMax?: number;
  unit?: string;
  decimals?: number;
  yMin?: number;
  yMax?: number;
  height?: number;
};

const BAND = 'rgba(13, 148, 136, 0.12)';
const MARKER = 'rgba(100, 116, 139, 0.7)';

type Extra = { band?: Props['band']; markers?: number[] };

// 注意範囲（帯）と目印（縦線）。点や線より奥に描く
const backdrop: Plugin<'line'> = {
  id: 'backdrop',
  beforeDatasetsDraw(chart) {
    const extra = (chart.options.plugins as { backdrop?: Extra }).backdrop;
    if (!extra) return;
    const { ctx, chartArea: area, scales } = chart;
    ctx.save();
    if (extra.band && (extra.band.min !== undefined || extra.band.max !== undefined)) {
      const top = extra.band.max !== undefined ? scales.y.getPixelForValue(extra.band.max) : area.top;
      const bottom = extra.band.min !== undefined ? scales.y.getPixelForValue(extra.band.min) : area.bottom;
      const y1 = Math.max(area.top, Math.min(top, bottom));
      const y2 = Math.min(area.bottom, Math.max(top, bottom));
      if (y2 > y1) {
        ctx.fillStyle = BAND;
        ctx.fillRect(area.left, y1, area.right - area.left, y2 - y1);
      }
    }
    ctx.strokeStyle = MARKER;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (const m of extra.markers ?? []) {
      const x = scales.x.getPixelForValue(m);
      if (x < area.left || x > area.right) continue;
      ctx.beginPath();
      ctx.moveTo(x, area.top);
      ctx.lineTo(x, area.bottom);
      ctx.stroke();
    }
    ctx.restore();
  },
};

const md = (ms: number) => {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

export default function LineChart({ series, band, markers, xMin, xMax, unit = '', decimals = 1, yMin, yMax, height = 180 }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvas.current) return;
    const datasets: ChartDataset<'line', { x: number; y: number }[]>[] = series.map((s) => ({
      label: s.label,
      data: s.points,
      borderColor: s.color,
      backgroundColor: s.color,
      borderWidth: 2,
      borderDash: s.dash,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointHitRadius: 12,
      pointStyle: s.pointStyle ?? 'circle',
      pointBackgroundColor: s.pointColors ?? s.color,
      pointBorderColor: '#fff',
      pointBorderWidth: 1.5,
      tension: 0,
    }));
    // 範囲の帯が画面に収まるよう、縦軸の幅を広げる
    const ys = series.flatMap((s) => s.points.map((p) => p.y));
    const lo = Math.min(...ys, band?.min ?? Infinity);
    const hi = Math.max(...ys, band?.max ?? -Infinity);
    const pad = Math.max((hi - lo) * 0.1, 10 ** -decimals);

    const chart = new Chart(canvas.current, {
      type: 'line',
      data: { datasets },
      plugins: [backdrop],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'nearest', intersect: false, axis: 'x' },
        scales: {
          x: {
            type: 'linear',
            min: xMin,
            max: xMax,
            ticks: { callback: (v) => md(Number(v)), maxTicksLimit: 5, color: '#64748b', font: { size: 11 } },
            grid: { color: 'rgba(148, 163, 184, 0.2)' },
          },
          y: {
            min: yMin ?? (Number.isFinite(lo) ? lo - pad : undefined),
            max: yMax ?? (Number.isFinite(hi) ? hi + pad : undefined),
            ticks: { callback: (v) => Number(v).toFixed(decimals), maxTicksLimit: 5, color: '#64748b', font: { size: 11 } },
            grid: { color: 'rgba(148, 163, 184, 0.2)' },
          },
        },
        plugins: {
          legend: { display: series.length > 1, position: 'bottom', labels: { usePointStyle: true, boxHeight: 8, color: '#334155' } },
          tooltip: {
            callbacks: {
              title: (items: TooltipItem<'line'>[]) => (items[0] ? fmtDateTime(new Date(items[0].parsed.x).toISOString()) : ''),
              label: (item: TooltipItem<'line'>) => `${item.dataset.label}: ${item.parsed.y.toFixed(decimals)}${unit}`,
            },
          },
          backdrop: { band, markers },
        } as never,
      },
    });
    return () => chart.destroy();
  }, [series, band, markers, xMin, xMax, unit, decimals, yMin, yMax]);

  return (
    <div style={{ height }} className="relative">
      <canvas ref={canvas} role="img" aria-label={series.map((s) => s.label).join('・') + 'の推移グラフ'} />
    </div>
  );
}
