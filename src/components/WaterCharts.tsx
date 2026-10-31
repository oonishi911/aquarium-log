// 水質の推移グラフ（要件 6.1 #6）。項目ごとに1枚、注意範囲を帯で、換水を縦の点線で表示する
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db/db';
import { tankRanges, waterSeries } from '../db/repo';
import type { WaterParameter } from '../db/types';
import { fmtRange, isOutOfRange, rangeFor, type Range } from '../lib/range';
import LineChart from './LineChart';
import { Badge, Card, Choice } from './ui';

const periods = { '30': '1か月', '90': '3か月', '365': '1年', all: 'すべて' } as const;
type Period = keyof typeof periods;

const LINE = '#0f766e';
const OUT = '#dc2626';

export default function WaterCharts({ tankId }: { tankId: string }) {
  const [period, setPeriod] = useState<Period>('90');
  const data = useLiveQuery(async () => {
    const [{ series, waterChanges }, ranges, params] = await Promise.all([
      waterSeries(db, tankId),
      tankRanges(db, tankId),
      db.waterParameters.orderBy('sort').toArray(),
    ]);
    return { series, waterChanges, ranges, params };
  }, [tankId]);

  // 期間の始まりは「今」から数える。データがない期間でも横軸はそろえる
  const xMin = useMemo(() => (period === 'all' ? undefined : Date.now() - Number(period) * 86400000), [period]);
  if (!data) return null;
  const withData = data.params.filter((p) => data.series[p.id]?.length);

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold">水質の推移</h2>
        <Link to={`/tanks/${tankId}/ranges`} className="text-sm text-teal-700">
          注意範囲を設定 ›
        </Link>
      </div>
      {withData.length === 0 ? (
        <p className="mb-2 text-sm text-slate-500">水質を記録すると、ここにグラフが出ます</p>
      ) : (
        <>
          <div className="mb-2">
            <Choice value={period} onChange={setPeriod} options={periods} />
          </div>
          {withData.map((p) => (
            <ParamChart
              key={p.id}
              param={p}
              points={data.series[p.id]}
              range={rangeFor(data.ranges, p.id)}
              waterChanges={data.waterChanges}
              xMin={xMin}
            />
          ))}
          <p className="text-xs text-slate-500">緑の帯 = 注意範囲 ／ 点線 = 換水 ／ 赤い点 = 範囲外</p>
        </>
      )}
    </div>
  );
}

function ParamChart({ param, points, range, waterChanges, xMin }: { param: WaterParameter; points: { at: string; value: number }[]; range: Range; waterChanges: string[]; xMin?: number }) {
  const shown = useMemo(() => points.filter((p) => xMin === undefined || new Date(p.at).getTime() >= xMin), [points, xMin]);
  const series = useMemo(
    () => [
      {
        label: param.label,
        color: LINE,
        points: shown.map((p) => ({ x: new Date(p.at).getTime(), y: p.value })),
        pointColors: shown.map((p) => (isOutOfRange(p.value, range) ? OUT : LINE)),
      },
    ],
    [param.label, shown, range],
  );
  const markers = useMemo(() => waterChanges.map((at) => new Date(at).getTime()), [waterChanges]);
  const band = useMemo(() => ({ min: range.min, max: range.max }), [range.min, range.max]);
  const outCount = shown.filter((p) => isOutOfRange(p.value, range)).length;
  const latest = points[points.length - 1];

  return (
    <Card>
      <div className="mb-1 flex items-baseline gap-2">
        <span className="font-bold">
          {param.label}
          {param.unit && <span className="ml-1 text-xs font-normal text-slate-500">{param.unit}</span>}
        </span>
        <span className={`text-sm ${isOutOfRange(latest.value, range) ? 'font-bold text-red-700' : 'text-slate-700'}`}>
          最新 {latest.value.toFixed(param.decimals)}
        </span>
        <span className="ml-auto text-xs text-slate-500">範囲 {fmtRange(range)}</span>
      </div>
      {outCount > 0 && (
        <div className="mb-1">
          <Badge tone="red">⚠ 範囲外 {outCount}件</Badge>
        </div>
      )}
      {shown.length ? (
        <LineChart series={series} band={band} markers={markers} xMin={xMin} xMax={xMin === undefined ? undefined : Date.now()} unit={param.unit} decimals={param.decimals} />
      ) : (
        <p className="py-4 text-center text-sm text-slate-500">この期間の記録はありません</p>
      )}
    </Card>
  );
}
