import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PhotoPicker } from '../components/Photos';
import { Choice, Field, MultiChoice, NumberInput, PageHeader, SaveBar, TextArea, TextInput } from '../components/ui';
import { db } from '../db/db';
import { livestockStatusLabels, livestockSymptoms, plantStatusLabels, plantSymptoms } from '../db/labels';
import { saveConditionLog } from '../db/repo';
import type { ConditionLog, ConditionTarget } from '../db/types';
import { fromLocalInput, toLocalInput } from '../lib/date';
import { savePhotos } from '../lib/image';

// 生体・水草の状態記録（新規: /condition/:targetType/:targetId/new、編集: /condition/:id/edit）
export default function ConditionForm() {
  const params = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState<Partial<ConditionLog>>();
  const [when, setWhen] = useState(toLocalInput(new Date().toISOString()));
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<ConditionLog>) => setD((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    (async () => {
      if (params.id) {
        const log = await db.conditionLogs.get(params.id);
        if (log) {
          setD(log);
          setWhen(toLocalInput(log.logged_at));
        }
        return;
      }
      const target_type = params.targetType as ConditionTarget;
      const target_id = params.targetId!;
      const target = target_type === 'livestock' ? await db.livestock.get(target_id) : await db.plants.get(target_id);
      if (target) setD({ target_type, target_id, tank_id: target.tank_id, status: target.status, symptoms: [] });
    })();
  }, [params.id, params.targetType, params.targetId]);

  if (!d?.target_type) return null;
  const isFish = d.target_type === 'livestock';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!d) return;
    setSaving(true);
    try {
      const { created_at: _c, updated_at: _u, ...rest } = d;
      const saved = await saveConditionLog(db, {
        ...rest,
        target_type: d.target_type!,
        target_id: d.target_id!,
        tank_id: d.tank_id!,
        status: d.status!,
        symptoms: d.symptoms ?? [],
        logged_at: fromLocalInput(when),
      });
      await savePhotos(db, files, 'condition', saved.id, saved.tank_id);
      navigate(-1);
    } catch (err) {
      alert(`保存できませんでした: ${(err as Error).message}`);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <PageHeader title={`${isFish ? '生体' : '水草'}の状態を記録`} back />
      <Field label="日時">
        <input type="datetime-local" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2" value={when} onChange={(e) => setWhen(e.target.value)} required />
      </Field>
      <Field label="状態">
        {isFish ? (
          <Choice value={d.status as keyof typeof livestockStatusLabels} onChange={(status) => set({ status })} options={livestockStatusLabels} />
        ) : (
          <Choice value={d.status as keyof typeof plantStatusLabels} onChange={(status) => set({ status })} options={plantStatusLabels} />
        )}
      </Field>
      <Field label="症状">
        <MultiChoice value={d.symptoms ?? []} onChange={(symptoms) => set({ symptoms })} options={isFish ? livestockSymptoms : plantSymptoms} />
      </Field>
      {isFish ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="体長（cm）">
              <NumberInput value={d.length_cm} onChange={(length_cm) => set({ length_cm })} />
            </Field>
            <Field label="体重（g）">
              <NumberInput value={d.weight_g} onChange={(weight_g) => set({ weight_g })} />
            </Field>
          </div>
          <Field label="対処内容" hint="投薬名・塩水浴など">
            <TextInput value={d.treatment} onChange={(treatment) => set({ treatment })} />
          </Field>
        </>
      ) : (
        <>
          <Field label="トリミング">
            <Choice value={d.trimmed ? 'yes' : 'no'} onChange={(v) => set({ trimmed: v === 'yes' })} options={{ no: 'なし', yes: 'した' }} />
            {d.trimmed && (
              <div className="mt-2">
                <TextInput value={d.trim_amount} onChange={(trim_amount) => set({ trim_amount })} placeholder="量の目安（例: 半分くらい）" />
              </div>
            )}
          </Field>
          <Field label="追肥">
            <Choice value={d.fertilized ? 'yes' : 'no'} onChange={(v) => set({ fertilized: v === 'yes' })} options={{ no: 'なし', yes: 'した' }} />
            {d.fertilized && (
              <div className="mt-2">
                <TextInput value={d.fertilizer} onChange={(fertilizer) => set({ fertilizer })} placeholder="肥料名" />
              </div>
            )}
          </Field>
        </>
      )}
      <Field label="メモ">
        <TextArea value={d.memo} onChange={(memo) => set({ memo })} />
      </Field>
      <Field label="写真を追加">
        <PhotoPicker files={files} onChange={setFiles} />
      </Field>
      <SaveBar saving={saving} />
    </form>
  );
}
