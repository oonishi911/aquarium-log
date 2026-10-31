import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PhotoPicker } from '../components/Photos';
import { btnSecondary, Choice, Field, NumberInput, PageHeader, SaveBar, Select, TextArea, TextInput } from '../components/ui';
import { db } from '../db/db';
import { filterTypeLabels, tankStatusLabels } from '../db/labels';
import { saveTank } from '../db/repo';
import type { Tank } from '../db/types';
import { savePhotos } from '../lib/image';

type Draft = Partial<Tank>;

export default function TankForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [t, setT] = useState<Draft>({ status: 'active' });
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (patch: Draft) => setT((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    if (id) db.tanks.get(id).then((tank) => tank && setT(tank));
  }, [id]);

  const calcVolume = t.width_cm && t.depth_cm && t.height_cm ? Math.round((t.width_cm * t.depth_cm * t.height_cm) / 1000) : undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!t.name?.trim()) return alert('名前を入れてください');
    setSaving(true);
    try {
      const { created_at: _c, updated_at: _u, ...draft } = t;
      const saved = await saveTank(db, { ...draft, name: t.name.trim(), status: t.status ?? 'active' });
      await savePhotos(db, files, 'tank', saved.id, saved.id);
      navigate(`/tanks/${saved.id}`, { replace: true });
    } catch (err) {
      alert(`保存できませんでした: ${(err as Error).message}`);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <PageHeader title={id ? '水槽を編集' : '水槽を追加'} back />
      <Field label="名前 *">
        <TextInput value={t.name} onChange={(name) => set({ name })} placeholder="リビング60cm" required />
      </Field>
      <Field label="状態">
        <Choice value={t.status} onChange={(status) => set({ status })} options={tankStatusLabels} />
      </Field>
      <Field label="サイズ（幅 × 奥行 × 高さ cm）">
        <div className="grid grid-cols-3 gap-2">
          <NumberInput value={t.width_cm} onChange={(width_cm) => set({ width_cm })} placeholder="60" />
          <NumberInput value={t.depth_cm} onChange={(depth_cm) => set({ depth_cm })} placeholder="30" />
          <NumberInput value={t.height_cm} onChange={(height_cm) => set({ height_cm })} placeholder="36" />
        </div>
      </Field>
      <Field label="水量（L）">
        <NumberInput value={t.volume_l} onChange={(volume_l) => set({ volume_l })} />
        {calcVolume !== undefined && calcVolume !== t.volume_l && (
          <button type="button" className={`${btnSecondary} mt-2 text-sm`} onClick={() => set({ volume_l: calcVolume })}>
            サイズから計算: 約{calcVolume}L を入れる
          </button>
        )}
      </Field>
      <Field label="立ち上げ日">
        <TextInput type="date" value={t.started_on} onChange={(started_on) => set({ started_on: started_on || undefined })} />
      </Field>
      <Field label="ろ過方式">
        <Select value={t.filter_type} onChange={(filter_type) => set({ filter_type })} options={filterTypeLabels} empty="未設定" />
      </Field>
      <Field label="照明" hint="機種名、点灯時間など">
        <TextInput value={t.lighting} onChange={(lighting) => set({ lighting })} placeholder="〇〇LED 10:00〜18:00" />
      </Field>
      <Field label="CO2添加" hint="空欄ならなし">
        <TextInput value={t.co2} onChange={(co2) => set({ co2 })} placeholder="1滴/秒" />
      </Field>
      <Field label="ソイル・底床">
        <TextInput value={t.substrate} onChange={(substrate) => set({ substrate })} />
      </Field>
      <Field label="ヒーター設定温度（℃）">
        <NumberInput value={t.heater_temp} onChange={(heater_temp) => set({ heater_temp })} placeholder="26" />
      </Field>
      <Field label="メモ">
        <TextArea value={t.memo} onChange={(memo) => set({ memo })} />
      </Field>
      <Field label="写真を追加">
        <PhotoPicker files={files} onChange={setFiles} />
      </Field>
      <SaveBar saving={saving} />
    </form>
  );
}
