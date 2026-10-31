import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { btnPrimary, btnSecondary, Card, NumberInput, PageHeader } from '../components/ui';
import { db } from '../db/db';
import { defaultWaterRanges } from '../db/labels';
import { saveTankRange, tankRanges } from '../db/repo';
import type { Range } from '../lib/range';

// 水槽ごとの注意範囲（/tanks/:id/ranges）。空欄の項目は初期値（一般的な目安）を使う
export default function RangeForm() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [edit, setEdit] = useState<Record<string, Range>>({});
  const [saving, setSaving] = useState(false);
  const data = useLiveQuery(async () => ({
    tank: await db.tanks.get(id),
    params: await db.waterParameters.orderBy('sort').toArray(),
  }), [id]);

  useEffect(() => {
    tankRanges(db, id).then((list) => setEdit(Object.fromEntries(list.map((r) => [r.parameter_id, { min: r.min, max: r.max }]))));
  }, [id]);

  if (!data?.tank) return null;
  // 表示ONの項目を先に、OFFの項目は後ろに出す
  const params = [...data.params.filter((p) => p.visible), ...data.params.filter((p) => !p.visible)];

  async function save() {
    setSaving(true);
    try {
      for (const p of data!.params) {
        const r = edit[p.id] ?? {};
        if (r.min !== undefined && r.max !== undefined && r.min > r.max) {
          setSaving(false);
          return alert(`${p.label}: 下限が上限より大きくなっています`);
        }
      }
      for (const p of data!.params) await saveTankRange(db, { tank_id: id, parameter_id: p.id, ...edit[p.id] });
      navigate(-1);
    } catch (err) {
      alert(`保存できませんでした: ${(err as Error).message}`);
      setSaving(false);
    }
  }

  const set = (pid: string, patch: Range) => setEdit((prev) => ({ ...prev, [pid]: { ...prev[pid], ...patch } }));

  return (
    <section>
      <PageHeader title={`注意範囲：${data.tank.name}`} back />
      <p className="mb-3 text-sm text-slate-600">範囲から外れた値は、グラフと記録一覧で赤く表示します。上限・下限とも空欄なら一般的な目安（薄い文字）を使います。片方だけ入れると、もう片方は制限なしになります。</p>
      <Card>
        <div className="mb-1 grid grid-cols-[1fr_5.5rem_auto_5.5rem] items-center gap-2 text-xs text-slate-500">
          <span>項目</span>
          <span>下限</span>
          <span />
          <span>上限</span>
        </div>
        {params.map((p) => {
          const def = defaultWaterRanges[p.id] ?? {};
          return (
            <div key={p.id} className="grid grid-cols-[1fr_5.5rem_auto_5.5rem] items-center gap-2 border-t py-2">
              <span className={p.visible ? '' : 'text-slate-500'}>
                {p.label}
                {p.unit && <span className="ml-1 text-xs text-slate-500">{p.unit}</span>}
              </span>
              <NumberInput value={edit[p.id]?.min} onChange={(min) => set(p.id, { min })} placeholder={def.min?.toString() ?? '—'} />
              <span className="text-slate-400">〜</span>
              <NumberInput value={edit[p.id]?.max} onChange={(max) => set(p.id, { max })} placeholder={def.max?.toString() ?? '—'} />
            </div>
          );
        })}
      </Card>
      <div className="mt-3 flex gap-2">
        <button type="button" className={`${btnPrimary} flex-1`} disabled={saving} onClick={save}>
          {saving ? '保存中…' : '保存'}
        </button>
        <button type="button" className={btnSecondary} onClick={() => setEdit({})}>
          すべて初期値に戻す
        </button>
      </div>
    </section>
  );
}
