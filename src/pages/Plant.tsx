import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ColorHistory from '../components/ColorHistory';
import { OwnerPhotos, PhotoPicker } from '../components/Photos';
import { plantName, TimelineList } from '../components/Timeline';
import { Badge, btnPrimary, btnSecondary, Card, Choice, Field, PageHeader, SaveBar, Select, TextArea, TextInput } from '../components/ui';
import { db } from '../db/db';
import { attentionPlant, plantPositionLabels, plantStatusLabels } from '../db/labels';
import { conditionTimeline, findOrCreateSpecies, savePlant } from '../db/repo';
import type { Plant } from '../db/types';
import { daysSince, fmtDate, today } from '../lib/date';
import { savePhotos } from '../lib/image';

type Draft = Partial<Plant> & { speciesName?: string };

export function PlantForm() {
  const { id, tankId } = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState<Draft>({ tank_id: tankId, status: 'good', planted_on: today() });
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (patch: Draft) => setD((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    if (!id) return;
    (async () => {
      const p = await db.plants.get(id);
      if (!p) return;
      setD({ ...p, speciesName: (await db.species.get(p.species_id))?.name });
    })();
  }, [id]);

  const options = useLiveQuery(async () => ({
    tanks: (await db.tanks.toArray()).filter((t) => t.status !== 'removed' || t.id === d.tank_id),
    species: await db.species.where('kind').equals('plant').toArray(),
  }), [d.tank_id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!d.tank_id) return alert('水槽を選んでください');
    if (!d.speciesName?.trim()) return alert('種類名を入れてください');
    setSaving(true);
    try {
      const species = await findOrCreateSpecies(db, 'plant', d.speciesName);
      const { speciesName: _s, created_at: _c, updated_at: _u, ...rest } = d;
      const saved = await savePlant(db, { ...rest, tank_id: d.tank_id, species_id: species.id, status: d.status ?? 'good' });
      await savePhotos(db, files, 'plant', saved.id, saved.tank_id);
      navigate(`/plants/${saved.id}`, { replace: true });
    } catch (err) {
      alert(`保存できませんでした: ${(err as Error).message}`);
      setSaving(false);
    }
  }

  if (!options) return null;
  return (
    <form onSubmit={submit}>
      <PageHeader title={id ? '水草を編集' : '水草を追加'} back />
      <Field label="水槽 *">
        <Select value={d.tank_id} onChange={(tank_id) => set({ tank_id })} options={options.tanks.map((t) => [t.id, t.name])} empty="選んでください" />
      </Field>
      <Field label="種類名 *">
        <TextInput value={d.speciesName} onChange={(speciesName) => set({ speciesName })} list="plant-species" placeholder="ロタラ・ロトンディフォリア" required />
        <datalist id="plant-species">
          {options.species.map((s) => (
            <option key={s.id} value={s.name} />
          ))}
        </datalist>
      </Field>
      <Field label="配置">
        <Choice value={d.position} onChange={(position) => set({ position })} options={plantPositionLabels} />
      </Field>
      <Field label="状態">
        <Choice value={d.status} onChange={(status) => set({ status })} options={plantStatusLabels} />
      </Field>
      <Field label="植えた日">
        <TextInput type="date" value={d.planted_on} onChange={(planted_on) => set({ planted_on: planted_on || undefined })} />
      </Field>
      <Field label="入手先">
        <TextInput value={d.source} onChange={(source) => set({ source })} />
      </Field>
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

export function PlantDetail() {
  const { id = '' } = useParams();
  const data = useLiveQuery(async () => {
    const p = await db.plants.get(id);
    if (!p) return null;
    const species = new Map((await db.species.toArray()).map((s) => [s.id, s.name]));
    const tank = await db.tanks.get(p.tank_id);
    const logs = await conditionTimeline(db, 'plant', id);
    return { p, species, tank, logs };
  }, [id]);
  if (!data) return null;
  const { p, species, tank, logs } = data;

  return (
    <section>
      <PageHeader title={plantName(p, species)} back />
      <Card>
        <div className="mb-2 flex flex-wrap gap-2">
          <Badge tone={attentionPlant.includes(p.status) ? 'amber' : p.status === 'good' ? 'green' : 'gray'}>{plantStatusLabels[p.status]}</Badge>
          {p.position && <Badge>{plantPositionLabels[p.position]}</Badge>}
        </div>
        <dl className="grid grid-cols-[5rem_1fr] gap-y-1 text-sm">
          <dt className="text-slate-500">水槽</dt>
          <dd>
            <Link to={`/tanks/${p.tank_id}?tab=plants`} className="text-teal-700">
              {tank?.name}
            </Link>
          </dd>
          <dt className="text-slate-500">植えた日</dt>
          <dd>{p.planted_on ? `${fmtDate(p.planted_on)}（${daysSince(p.planted_on)}日目）` : '—'}</dd>
          <dt className="text-slate-500">入手先</dt>
          <dd>{p.source || '—'}</dd>
        </dl>
        {p.memo && <p className="mt-2 whitespace-pre-wrap border-t pt-2 text-sm">{p.memo}</p>}
        <div className="mt-2">
          <OwnerPhotos owner="plant" id={p.id} />
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link to={`/condition/plant/${p.id}/new`} className={`${btnPrimary} text-center`}>
          状態を記録
        </Link>
        <Link to={`/plants/${p.id}/edit`} className={`${btnSecondary} py-3 text-center`}>
          編集
        </Link>
      </div>

      <ColorHistory plantId={p.id} />

      <h2 className="mb-2 mt-5 font-bold">状態の履歴</h2>
      <TimelineList items={logs} empty="まだ状態の記録がありません" />
    </section>
  );
}
