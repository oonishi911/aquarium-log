import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PhotoPicker } from '../components/Photos';
import { Choice, Field, NumberInput, PageHeader, SaveBar, TextArea } from '../components/ui';
import { db } from '../db/db';
import { measureMethodLabels } from '../db/labels';
import { saveWaterReading } from '../db/repo';
import type { WaterReading } from '../db/types';
import { fromLocalInput, toLocalInput } from '../lib/date';
import { savePhotos } from '../lib/image';

// 水質の記録（新規: /tanks/:tankId/water/new、編集: /water/:id/edit）。測った項目だけ入れればよい
export default function WaterForm() {
  const { id, tankId } = useParams();
  const navigate = useNavigate();
  const [r, setR] = useState<Partial<WaterReading>>({ tank_id: tankId, source: 'manual' });
  const [when, setWhen] = useState(toLocalInput(new Date().toISOString()));
  const [values, setValues] = useState<Record<string, number | undefined>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const reading = await db.waterReadings.get(id);
      if (!reading) return;
      setR(reading);
      setWhen(toLocalInput(reading.measured_at));
      const vals = await db.waterValues.where('reading_id').equals(id).toArray();
      setValues(Object.fromEntries(vals.map((v) => [v.parameter_id, v.value])));
    })();
  }, [id]);

  const info = useLiveQuery(async () => ({
    tank: r.tank_id ? await db.tanks.get(r.tank_id) : undefined,
    params: await db.waterParameters.orderBy('sort').toArray(),
  }), [r.tank_id]);
  if (!info) return null;
  // 設定で表示ONの項目と、編集中の記録にすでに値がある項目を出す
  const shown = info.params.filter((p) => p.visible || values[p.id] !== undefined);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const filled = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined && !Number.isNaN(v))) as Record<string, number>;
    if (!Object.keys(filled).length && !r.memo?.trim()) return alert('測った値かメモを1つ以上入れてください');
    setSaving(true);
    try {
      const { created_at: _c, updated_at: _u, ...rest } = r;
      const saved = await saveWaterReading(db, { ...rest, tank_id: r.tank_id!, source: r.source ?? 'manual', measured_at: fromLocalInput(when) }, filled);
      await savePhotos(db, files, 'water', saved.id, saved.tank_id);
      navigate(`/tanks/${saved.tank_id}?tab=water`, { replace: true });
    } catch (err) {
      alert(`保存できませんでした: ${(err as Error).message}`);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <PageHeader title={`水質を記録${info.tank ? `：${info.tank.name}` : ''}`} back />
      <Field label="日時">
        <input type="datetime-local" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2" value={when} onChange={(e) => setWhen(e.target.value)} required />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        {shown.map((p) => (
          <Field key={p.id} label={`${p.label}${p.unit ? `（${p.unit}）` : ''}`}>
            <NumberInput value={values[p.id]} onChange={(v) => setValues((prev) => ({ ...prev, [p.id]: v }))} step={p.decimals ? String(10 ** -p.decimals) : '1'} />
          </Field>
        ))}
      </div>
      <p className="mb-3 text-xs text-slate-500">
        ほかの項目（KH・GH・亜硝酸など）は
        <Link to="/settings" className="text-teal-700">
          設定
        </Link>
        で表示できます
      </p>
      <Field label="測定方法">
        <Choice value={r.method} onChange={(method) => setR({ ...r, method })} options={measureMethodLabels} />
      </Field>
      <Field label="メモ">
        <TextArea value={r.memo} onChange={(memo) => setR({ ...r, memo })} placeholder="水が白濁 など" />
      </Field>
      <Field label="写真を追加">
        <PhotoPicker files={files} onChange={setFiles} />
      </Field>
      <SaveBar saving={saving} />
    </form>
  );
}
