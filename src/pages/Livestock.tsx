import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { OwnerPhotos, PhotoPicker } from '../components/Photos';
import { livestockName, TimelineList } from '../components/Timeline';
import { Badge, btnPrimary, btnSecondary, Card, Choice, Field, NumberInput, PageHeader, SaveBar, Select, TextArea, TextInput } from '../components/ui';
import { db } from '../db/db';
import { attentionLivestock, inactiveLivestock, livestockStatusLabels, sexLabels, speciesKindLabels, unitLabels } from '../db/labels';
import { conditionTimeline, findOrCreateSpecies, saveLivestock } from '../db/repo';
import type { Livestock, SpeciesKind } from '../db/types';
import { fmtDate, fmtDateTime, today } from '../lib/date';
import { savePhotos } from '../lib/image';

const { plant: _plant, ...livestockKinds } = speciesKindLabels;

type Draft = Partial<Livestock> & { kind?: Exclude<SpeciesKind, 'plant'>; speciesName?: string };

export function LivestockForm() {
  const { id, tankId } = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState<Draft>({ tank_id: tankId, unit: 'group', count: 1, status: 'healthy', kind: 'fish', acquired_on: today() });
  const [original, setOriginal] = useState<Livestock>();
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (patch: Draft) => setD((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    if (!id) return;
    (async () => {
      const l = await db.livestock.get(id);
      if (!l) return;
      const sp = await db.species.get(l.species_id);
      setOriginal(l);
      setD({ ...l, speciesName: sp?.name, kind: sp?.kind === 'plant' ? 'other' : sp?.kind });
    })();
  }, [id]);

  const options = useLiveQuery(async () => {
    const [tanks, species, mates] = await Promise.all([
      db.tanks.toArray(),
      db.species.filter((s) => s.kind !== 'plant').toArray(),
      d.tank_id ? db.livestock.where('tank_id').equals(d.tank_id).toArray() : Promise.resolve([]),
    ]);
    const speciesName = new Map(species.map((s) => [s.id, s.name]));
    return {
      tanks: tanks.filter((t) => t.status !== 'removed' || t.id === d.tank_id),
      species,
      mates: mates.filter((m) => m.id !== id && m.unit === 'individual' && !inactiveLivestock.includes(m.status)).map((m) => [m.id, livestockName(m, speciesName)] as [string, string]),
    };
  }, [d.tank_id, id]);

  const changed = original && (original.tank_id !== d.tank_id || (d.unit === 'group' && original.count !== d.count));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!d.tank_id) return alert('水槽を選んでください');
    if (!d.speciesName?.trim()) return alert('種類名を入れてください');
    if (d.unit === 'group' && (!d.count || d.count < 1)) return alert('数を入れてください');
    setSaving(true);
    try {
      const species = await findOrCreateSpecies(db, d.kind ?? 'fish', d.speciesName);
      const { kind: _k, speciesName: _s, created_at: _c, updated_at: _u, ...rest } = d;
      const saved = await saveLivestock(
        db,
        { ...rest, tank_id: d.tank_id, species_id: species.id, unit: d.unit ?? 'group', count: d.count ?? 1, status: d.status ?? 'healthy' },
        reason || undefined,
      );
      await savePhotos(db, files, 'livestock', saved.id, saved.tank_id);
      navigate(`/livestock/${saved.id}`, { replace: true });
    } catch (err) {
      alert(`保存できませんでした: ${(err as Error).message}`);
      setSaving(false);
    }
  }

  if (!options) return null;
  return (
    <form onSubmit={submit}>
      <PageHeader title={id ? '生体を編集' : '生体を追加'} back />
      <Field label="水槽 *" hint={id ? '変えると水槽の移動として履歴に残ります' : undefined}>
        <Select value={d.tank_id} onChange={(tank_id) => set({ tank_id, partner_id: undefined })} options={options.tanks.map((t) => [t.id, t.name])} empty="選んでください" />
      </Field>
      <Field label="分類">
        <Choice value={d.kind} onChange={(kind) => set({ kind })} options={livestockKinds} />
      </Field>
      <Field label="種類名 *">
        <TextInput value={d.speciesName} onChange={(speciesName) => set({ speciesName })} list="species-list" placeholder="ネオンテトラ" required />
        <datalist id="species-list">
          {options.species.map((s) => (
            <option key={s.id} value={s.name} />
          ))}
        </datalist>
      </Field>
      <Field label="管理単位" hint="ふだんは群れ。ペアなどはオス・メスを1匹ずつ「個体」で登録します">
        <Choice value={d.unit} onChange={(unit) => set({ unit, count: unit === 'individual' ? 1 : d.count })} options={unitLabels} />
      </Field>
      {d.unit === 'group' ? (
        <Field label="数 *">
          <NumberInput value={d.count} onChange={(count) => set({ count })} step="1" />
        </Field>
      ) : (
        <>
          <Field label="個体名・呼び名">
            <TextInput value={d.nickname} onChange={(nickname) => set({ nickname })} placeholder="オス1" />
          </Field>
          <Field label="ペア相手" hint="同じ水槽の個体から選べます">
            <Select value={d.partner_id} onChange={(partner_id) => set({ partner_id })} options={options.mates} empty="なし" />
          </Field>
        </>
      )}
      {changed && (
        <Field label="変更の理由" hint="例: 2匹死亡、追加購入、隔離のため移動">
          <TextInput value={reason} onChange={setReason} />
        </Field>
      )}
      <Field label="性別">
        <Choice value={d.sex ?? 'unknown'} onChange={(sex) => set({ sex })} options={sexLabels} />
      </Field>
      <Field label="状態">
        <Choice value={d.status} onChange={(status) => set({ status })} options={livestockStatusLabels} />
      </Field>
      <Field label="導入日">
        <TextInput type="date" value={d.acquired_on} onChange={(acquired_on) => set({ acquired_on: acquired_on || undefined })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="入手先">
          <TextInput value={d.source} onChange={(source) => set({ source })} />
        </Field>
        <Field label="価格（円）">
          <NumberInput value={d.price} onChange={(price) => set({ price })} step="1" />
        </Field>
      </div>
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

export function LivestockDetail() {
  const { id = '' } = useParams();
  const data = useLiveQuery(async () => {
    const l = await db.livestock.get(id);
    if (!l) return null;
    const species = new Map((await db.species.toArray()).map((s) => [s.id, s.name]));
    const tanks = new Map((await db.tanks.toArray()).map((t) => [t.id, t.name]));
    const partner = l.partner_id ? await db.livestock.get(l.partner_id) : undefined;
    const moves = (await db.movementLogs.where('livestock_id').equals(id).sortBy('logged_at')).reverse();
    const logs = await conditionTimeline(db, 'livestock', id);
    return { l, species, tanks, partner, moves, logs };
  }, [id]);
  if (!data) return null;
  const { l, species, tanks, partner, moves, logs } = data;

  return (
    <section>
      <PageHeader title={livestockName(l, species)} back />
      <Card>
        <div className="mb-2 flex flex-wrap gap-2">
          <Badge tone={attentionLivestock.includes(l.status) ? 'amber' : l.status === 'healthy' ? 'green' : 'gray'}>{livestockStatusLabels[l.status]}</Badge>
          <Badge>{unitLabels[l.unit]}</Badge>
          {l.sex && <Badge>{sexLabels[l.sex]}</Badge>}
        </div>
        <dl className="grid grid-cols-[5rem_1fr] gap-y-1 text-sm">
          <dt className="text-slate-500">水槽</dt>
          <dd>
            <Link to={`/tanks/${l.tank_id}?tab=livestock`} className="text-teal-700">
              {tanks.get(l.tank_id)}
            </Link>
          </dd>
          {partner && (
            <>
              <dt className="text-slate-500">ペア</dt>
              <dd>
                <Link to={`/livestock/${partner.id}`} className="text-teal-700">
                  {livestockName(partner, species)}
                </Link>
              </dd>
            </>
          )}
          <dt className="text-slate-500">導入日</dt>
          <dd>{l.acquired_on ? fmtDate(l.acquired_on) : '—'}</dd>
          <dt className="text-slate-500">入手先</dt>
          <dd>
            {l.source || '—'}
            {l.price !== undefined && `（${l.price.toLocaleString()}円）`}
          </dd>
        </dl>
        {l.memo && <p className="mt-2 whitespace-pre-wrap border-t pt-2 text-sm">{l.memo}</p>}
        <div className="mt-2">
          <OwnerPhotos owner="livestock" id={l.id} />
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link to={`/condition/livestock/${l.id}/new`} className={`${btnPrimary} text-center`}>
          状態を記録
        </Link>
        <Link to={`/livestock/${l.id}/edit`} className={`${btnSecondary} py-3 text-center`}>
          編集・数の増減
        </Link>
      </div>

      <h2 className="mb-2 mt-5 font-bold">状態の履歴</h2>
      <TimelineList items={logs} empty="まだ状態の記録がありません" />

      {moves.length > 0 && (
        <>
          <h2 className="mb-2 mt-5 font-bold">移動・増減の履歴</h2>
          <ul className="rounded-xl border border-slate-200 bg-white text-sm">
            {moves.map((m) => (
              <li key={m.id} className="border-b p-2 last:border-b-0">
                <span className="mr-2 text-slate-500">{fmtDateTime(m.logged_at)}</span>
                {m.from_tank_id && m.to_tank_id && `${tanks.get(m.from_tank_id)} → ${tanks.get(m.to_tank_id)} `}
                {m.count_change !== undefined && `${m.count_change > 0 ? '+' : ''}${m.count_change}匹 `}
                {m.reason && <span className="text-slate-600">（{m.reason}）</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
