import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PhotoPicker } from '../components/Photos';
import { Field, NumberInput, PageHeader, SaveBar, Select, TextArea, TextInput } from '../components/ui';
import { db } from '../db/db';
import { maintenanceTypeLabels } from '../db/labels';
import { saveMaintenanceLog } from '../db/repo';
import type { MaintenanceLog } from '../db/types';
import { fromLocalInput, toLocalInput } from '../lib/date';
import { savePhotos } from '../lib/image';

// 作業記録（新規: /tanks/:tankId/maintenance/new、編集: /maintenance/:id/edit）
export default function MaintenanceForm() {
  const { id, tankId } = useParams();
  const navigate = useNavigate();
  const [m, setM] = useState<Partial<MaintenanceLog>>({ tank_id: tankId });
  const [when, setWhen] = useState(toLocalInput(new Date().toISOString()));
  const [templateId, setTemplateId] = useState<string>();
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<MaintenanceLog>) => setM((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    if (!id) return;
    db.maintenanceLogs.get(id).then((log) => {
      if (!log) return;
      setM(log);
      setWhen(toLocalInput(log.done_at));
    });
  }, [id]);

  const info = useLiveQuery(async () => ({
    tank: m.tank_id ? await db.tanks.get(m.tank_id) : undefined,
    templates: await db.maintenanceTemplates.orderBy('name').toArray(),
  }), [m.tank_id]);
  if (!info) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!m.type) return alert('作業の種類を選んでください');
    setSaving(true);
    try {
      const { created_at: _c, updated_at: _u, ...rest } = m;
      const saved = await saveMaintenanceLog(db, { ...rest, tank_id: m.tank_id!, type: m.type, done_at: fromLocalInput(when) });
      await savePhotos(db, files, 'maintenance', saved.id, saved.tank_id);
      navigate(`/tanks/${saved.tank_id}?tab=work`, { replace: true });
    } catch (err) {
      alert(`保存できませんでした: ${(err as Error).message}`);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <PageHeader title={`作業を記録${info.tank ? `：${info.tank.name}` : ''}`} back />
      {!id && info.templates.length > 0 && (
        <Field label="テンプレート（タップで入力）">
          <div className="flex flex-wrap gap-2">
            {info.templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTemplateId(t.id);
                  set({ type: t.type, amount: t.amount, unit: t.unit, memo: t.memo });
                }}
                className={`rounded-full border px-3 py-2 text-sm ${templateId === t.id ? 'border-teal-700 bg-teal-700 text-white' : 'border-teal-700 bg-white text-teal-800'}`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </Field>
      )}
      <Field label="日時">
        <input type="datetime-local" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2" value={when} onChange={(e) => setWhen(e.target.value)} required />
      </Field>
      <Field label="作業の種類 *">
        <Select value={m.type} onChange={(type) => set({ type })} options={maintenanceTypeLabels} empty="選んでください" />
      </Field>
      <Field label="量">
        <div className="grid grid-cols-[1fr_6rem] gap-2">
          <NumberInput value={m.amount} onChange={(amount) => set({ amount })} />
          <TextInput value={m.unit} onChange={(unit) => set({ unit })} placeholder="% / L" />
        </div>
      </Field>
      <Field label="内容メモ">
        <TextArea value={m.memo} onChange={(memo) => set({ memo })} />
      </Field>
      <Field label="写真を追加">
        <PhotoPicker files={files} onChange={setFiles} />
      </Field>
      <SaveBar saving={saving} />
    </form>
  );
}
