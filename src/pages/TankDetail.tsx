import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PhotoGrid } from '../components/Photos';
import { livestockName, plantName, TimelineList } from '../components/Timeline';
import { Badge, btnPrimary, btnSecondary, Card, Empty, PageHeader } from '../components/ui';
import { db } from '../db/db';
import {
  attentionLivestock,
  attentionPlant,
  filterTypeLabels,
  inactiveLivestock,
  livestockStatusLabels,
  plantPositionLabels,
  plantStatusLabels,
  sexLabels,
  tankStatusLabels,
} from '../db/labels';
import { timeline } from '../db/repo';
import type { Tank } from '../db/types';
import { daysSince, fmtDate } from '../lib/date';
import { savePhotos } from '../lib/image';

const tabs = [
  ['overview', '概要'],
  ['livestock', '生体'],
  ['plants', '水草'],
  ['water', '水質'],
  ['work', '作業'],
  ['photos', '写真'],
] as const;
type Tab = (typeof tabs)[number][0];

export default function TankDetail() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'overview';
  const tank = useLiveQuery(() => db.tanks.get(id), [id]);
  if (tank === undefined) return null;

  return (
    <section>
      <PageHeader title={tank.name} back right={tank.status !== 'active' && <Badge>{tankStatusLabels[tank.status]}</Badge>} />
      <div className="-mx-4 mb-3 flex overflow-x-auto border-b bg-white px-2">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setParams({ tab: key }, { replace: true })}
            className={`shrink-0 px-3 py-2 ${tab === key ? 'border-b-2 border-teal-700 font-bold text-teal-800' : 'text-slate-600'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview tank={tank} />}
      {tab === 'livestock' && <LivestockTab tankId={id} />}
      {tab === 'plants' && <PlantsTab tankId={id} />}
      {tab === 'water' && <RecordsTab tankId={id} kind="water" />}
      {tab === 'work' && <RecordsTab tankId={id} kind="maintenance" />}
      {tab === 'photos' && <PhotosTab tankId={id} />}
    </section>
  );
}

function Overview({ tank }: { tank: Tank }) {
  const rows: [string, string | undefined][] = [
    ['サイズ', tank.width_cm || tank.depth_cm || tank.height_cm ? `${tank.width_cm ?? '?'}×${tank.depth_cm ?? '?'}×${tank.height_cm ?? '?'} cm` : undefined],
    ['水量', tank.volume_l !== undefined ? `${tank.volume_l} L` : undefined],
    ['立ち上げ日', tank.started_on && `${fmtDate(tank.started_on)}（${daysSince(tank.started_on)}日目）`],
    ['ろ過', tank.filter_type && filterTypeLabels[tank.filter_type]],
    ['照明', tank.lighting],
    ['CO2', tank.co2 || 'なし'],
    ['底床', tank.substrate],
    ['ヒーター', tank.heater_temp !== undefined ? `${tank.heater_temp}℃` : undefined],
  ];
  return (
    <div>
      <Card>
        <dl className="grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-slate-500">{k}</dt>
              <dd>{v || '—'}</dd>
            </div>
          ))}
        </dl>
        {tank.memo && <p className="mt-2 whitespace-pre-wrap border-t pt-2 text-sm">{tank.memo}</p>}
      </Card>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link to={`/tanks/${tank.id}/water/new`} className={`${btnPrimary} text-center`}>
          水質を記録
        </Link>
        <Link to={`/tanks/${tank.id}/maintenance/new`} className={`${btnPrimary} text-center`}>
          作業を記録
        </Link>
      </div>
      <Link to={`/tanks/${tank.id}/edit`} className={`${btnSecondary} mt-3 block text-center`}>
        水槽の情報を編集
      </Link>
    </div>
  );
}

function LivestockTab({ tankId }: { tankId: string }) {
  const [showPast, setShowPast] = useState(false);
  const data = useLiveQuery(async () => {
    const list = await db.livestock.where('tank_id').equals(tankId).toArray();
    const species = new Map((await db.species.toArray()).map((s) => [s.id, s.name]));
    list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return { list, species };
  }, [tankId]);
  if (!data) return null;
  const current = data.list.filter((l) => !inactiveLivestock.includes(l.status));
  const past = data.list.filter((l) => inactiveLivestock.includes(l.status));
  const total = current.reduce((sum, l) => sum + l.count, 0);

  const render = (l: (typeof data.list)[number]) => (
    <Card key={l.id} to={`/livestock/${l.id}`}>
      <div className="flex items-center gap-2">
        <span className="flex-1 font-bold">{livestockName(l, data.species)}</span>
        {l.sex && l.sex !== 'unknown' && <span className="text-sm">{sexLabels[l.sex]}</span>}
        <Badge tone={attentionLivestock.includes(l.status) ? 'amber' : l.status === 'healthy' ? 'green' : 'gray'}>{livestockStatusLabels[l.status]}</Badge>
      </div>
      {l.partner_id && <p className="text-xs text-slate-500">ペア: {data.list.find((p) => p.id === l.partner_id)?.nickname ?? 'あり'}</p>}
    </Card>
  );

  return (
    <div>
      <p className="mb-2 text-sm text-slate-600">飼育中 {total}匹</p>
      {current.length ? current.map(render) : <Empty>まだ生体が登録されていません</Empty>}
      {past.length > 0 && (
        <>
          <button type="button" className="mb-2 text-sm text-teal-700" onClick={() => setShowPast(!showPast)}>
            {showPast ? '過去の生体を隠す' : `過去の生体を表示（${past.length}）`}
          </button>
          {showPast && past.map(render)}
        </>
      )}
      <Link to={`/tanks/${tankId}/livestock/new`} className={`${btnPrimary} mt-2 block text-center`}>
        ＋ 生体を追加
      </Link>
    </div>
  );
}

function PlantsTab({ tankId }: { tankId: string }) {
  const [showPast, setShowPast] = useState(false);
  const data = useLiveQuery(async () => {
    const list = await db.plants.where('tank_id').equals(tankId).toArray();
    const species = new Map((await db.species.toArray()).map((s) => [s.id, s.name]));
    list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return { list, species };
  }, [tankId]);
  if (!data) return null;
  const current = data.list.filter((p) => p.status !== 'removed');
  const past = data.list.filter((p) => p.status === 'removed');

  const render = (p: (typeof data.list)[number]) => (
    <Card key={p.id} to={`/plants/${p.id}`}>
      <div className="flex items-center gap-2">
        <span className="flex-1 font-bold">{plantName(p, data.species)}</span>
        {p.position && <span className="text-sm text-slate-500">{plantPositionLabels[p.position]}</span>}
        <Badge tone={attentionPlant.includes(p.status) ? 'amber' : p.status === 'good' ? 'green' : 'gray'}>{plantStatusLabels[p.status]}</Badge>
      </div>
    </Card>
  );

  return (
    <div>
      {current.length ? current.map(render) : <Empty>まだ水草が登録されていません</Empty>}
      {past.length > 0 && (
        <>
          <button type="button" className="mb-2 text-sm text-teal-700" onClick={() => setShowPast(!showPast)}>
            {showPast ? '撤去した水草を隠す' : `撤去した水草を表示（${past.length}）`}
          </button>
          {showPast && past.map(render)}
        </>
      )}
      <Link to={`/tanks/${tankId}/plants/new`} className={`${btnPrimary} mt-2 block text-center`}>
        ＋ 水草を追加
      </Link>
    </div>
  );
}

function RecordsTab({ tankId, kind }: { tankId: string; kind: 'water' | 'maintenance' }) {
  const items = useLiveQuery(async () => (await timeline(db, tankId)).filter((i) => i.kind === kind), [tankId, kind]);
  return (
    <div>
      <Link to={`/tanks/${tankId}/${kind}/new`} className={`${btnPrimary} mb-3 block text-center`}>
        ＋ {kind === 'water' ? '水質を記録' : '作業を記録'}
      </Link>
      <TimelineList items={items} />
    </div>
  );
}

function PhotosTab({ tankId }: { tankId: string }) {
  const photos = useLiveQuery(async () => (await db.photos.where('tank_id').equals(tankId).sortBy('taken_at')).reverse(), [tankId]);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <label className={`${btnPrimary} mb-3 block cursor-pointer text-center`}>
        {busy ? '保存中…' : '＋ 水槽の写真を追加'}
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            setBusy(true);
            try {
              await savePhotos(db, files, 'tank', tankId, tankId);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <p className="mb-2 text-xs text-slate-500">生体・水草・記録に付けた写真もここにまとめて出ます</p>
      {photos && (photos.length ? <PhotoGrid photos={photos} size="h-24 w-24" /> : <Empty>まだ写真がありません</Empty>)}
    </div>
  );
}
