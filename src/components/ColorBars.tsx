import type { ColorAnalysis } from '../db/types';
import { Badge } from './ui';

// 色の表示。色が見分けにくい場合も読めるよう、必ず文字ラベルと数値を並べる
export const colorKinds = [
  { key: 'green_pct', label: '緑', color: '#2f9e44' },
  { key: 'yellow_pct', label: '黄', color: '#c28a00' },
  { key: 'brown_pct', label: '茶', color: '#9a5b1e' },
  { key: 'other_pct', label: 'その他', color: '#94a3b8' },
] as const;

// 色の割合の横棒と、前回からの差
export function ColorBars({ current, previous }: { current: Pick<ColorAnalysis, 'green_pct' | 'yellow_pct' | 'brown_pct' | 'other_pct'>; previous?: ColorAnalysis }) {
  return (
    <div>
      <div className="mb-3 flex h-4 gap-[2px] overflow-hidden rounded">
        {colorKinds.map((k) => current[k.key] > 0 && <div key={k.key} style={{ width: `${current[k.key]}%`, background: k.color }} title={`${k.label} ${current[k.key]}%`} />)}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500">
            <th className="text-left font-normal">色</th>
            <th className="text-right font-normal">今回</th>
            {previous && <th className="text-right font-normal">前回</th>}
            {previous && <th className="text-right font-normal">差</th>}
          </tr>
        </thead>
        <tbody>
          {colorKinds.map((k) => {
            const diff = previous ? Math.round((current[k.key] - previous[k.key]) * 10) / 10 : 0;
            return (
              <tr key={k.key}>
                <td>
                  <span className="mr-1 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: k.color }} />
                  {k.label}
                </td>
                <td className="text-right font-bold">{current[k.key]}%</td>
                {previous && <td className="text-right text-slate-500">{previous[k.key]}%</td>}
                {previous && <td className="text-right">{diff > 0 ? `+${diff}` : diff}pt</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      {previous && !previous.condition_ok && (
        <p className="mt-1">
          <Badge tone="amber">前回は撮影条件違い</Badge>
        </p>
      )}
    </div>
  );
}
