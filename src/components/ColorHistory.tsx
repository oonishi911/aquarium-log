// 水草詳細の「色の変化」: 推移グラフ（要件 6.1 #5）と、保存したレポートの一覧
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db/db';
import { colorAnalysesOf } from '../db/repo';
import { fmtDateTime } from '../lib/date';
import { colorKinds } from './ColorBars';
import LineChart, { type Series } from './LineChart';
import { Badge, btnPrimary, Card, Empty } from './ui';

// 緑・黄は色覚によっては見分けにくいので、点の形と線の種類でも区別する
const styles: Record<string, Pick<Series, 'pointStyle' | 'dash'>> = {
  green_pct: { pointStyle: 'circle' },
  yellow_pct: { pointStyle: 'triangle', dash: [6, 3] },
  brown_pct: { pointStyle: 'rect', dash: [2, 2] },
};

export default function ColorHistory({ plantId }: { plantId: string }) {
  const analyses = useLiveQuery(() => colorAnalysesOf(db, plantId), [plantId]);
  const series = useMemo<Series[]>(
    () =>
      colorKinds
        .filter((k) => k.key !== 'other_pct')
        .map((k) => ({
          label: k.label,
          color: k.color,
          points: (analyses ?? []).map((a) => ({ x: new Date(a.taken_at).getTime(), y: a[k.key] })),
          ...styles[k.key],
        })),
    [analyses],
  );
  if (!analyses) return null;

  return (
    <div>
      <div className="mb-2 mt-5 flex items-center justify-between">
        <h2 className="font-bold">色の変化</h2>
        <Link to="/guide" className="text-sm text-teal-700">
          撮影ガイド ›
        </Link>
      </div>
      <Link to={`/plants/${plantId}/color`} className={`${btnPrimary} mb-3 block text-center`}>
        色変化レポートを作る
      </Link>
      {analyses.length === 0 && <Empty>写真の一部を囲むと、緑・黄・茶の割合を調べて前回と比べます</Empty>}
      {analyses.length >= 2 && (
        <Card>
          <LineChart series={series} unit="%" decimals={0} yMin={0} yMax={100} height={200} />
        </Card>
      )}
      <ul>
        {analyses
          .slice()
          .reverse()
          .map((a) => (
            <li key={a.id} className="mb-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                <span>{fmtDateTime(a.taken_at)}</span>
                {!a.condition_ok && <Badge tone="amber">撮影条件違い</Badge>}
                <button
                  type="button"
                  className="ml-auto text-red-600"
                  onClick={() => {
                    if (confirm('このレポートを削除しますか？（写真は残ります）')) db.colorAnalyses.delete(a.id);
                  }}
                >
                  削除
                </button>
              </div>
              <p className="text-sm font-bold">
                緑 {a.green_pct}% ・ 黄 {a.yellow_pct}% ・ 茶 {a.brown_pct}%
              </p>
              <p className="text-sm text-slate-700">{a.generated_text}</p>
              {a.condition_memo && <p className="text-xs text-slate-500">撮影メモ: {a.condition_memo}</p>}
            </li>
          ))}
      </ul>
    </div>
  );
}
