import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db/db';
import { livestockStatusLabels, maintenanceTypeLabels, measureMethodLabels, plantStatusLabels } from '../db/labels';
import { deleteConditionLog, deleteMaintenanceLog, deleteWaterReading, type TimelineItem } from '../db/repo';
import type { Livestock, LivestockStatus, Plant, PlantStatus, WaterParameter } from '../db/types';
import { fmtDateTime } from '../lib/date';
import { OwnerPhotos } from './Photos';
import { Badge, Empty } from './ui';

// 生体・水草・水槽の表示名をまとめて引く
export function useNames() {
  return useLiveQuery(async () => {
    const [tanks, species, livestock, plants, params] = await Promise.all([
      db.tanks.toArray(),
      db.species.toArray(),
      db.livestock.toArray(),
      db.plants.toArray(),
      db.waterParameters.orderBy('sort').toArray(),
    ]);
    const speciesName = new Map(species.map((s) => [s.id, s.name]));
    return {
      tank: new Map(tanks.map((t) => [t.id, t.name])),
      livestock: new Map(livestock.map((l) => [l.id, livestockName(l, speciesName)])),
      plant: new Map(plants.map((p) => [p.id, plantName(p, speciesName)])),
      params,
    };
  });
}

export function livestockName(l: Livestock, speciesName: Map<string, string>) {
  const sp = speciesName.get(l.species_id) ?? '（種類不明）';
  return l.unit === 'individual' ? `${sp}${l.nickname ? `「${l.nickname}」` : ''}` : `${sp} ×${l.count}`;
}

export function plantName(p: Plant, speciesName: Map<string, string>) {
  return speciesName.get(p.species_id) ?? '（種類不明）';
}

export function fmtValue(p: WaterParameter, v: number) {
  return `${v.toFixed(p.decimals)}${p.unit}`;
}

export function waterSummary(values: Record<string, number>, params: WaterParameter[]) {
  return params
    .filter((p) => values[p.id] !== undefined)
    .map((p) => `${p.label} ${fmtValue(p, values[p.id])}`)
    .join(' / ');
}

const kindLabel = { water: '水質', maintenance: '作業', condition: '状態' } as const;
const kindTone = { water: 'green', maintenance: 'gray', condition: 'amber' } as const;

function Row({ item, names, showTank }: { item: TimelineItem; names: NonNullable<ReturnType<typeof useNames>>; showTank: boolean }) {
  let title = '';
  let detail = '';
  let editTo = '';
  let owner: 'water' | 'maintenance' | 'condition' = 'water';
  let remove: () => Promise<void>;

  if (item.kind === 'water') {
    title = waterSummary(item.values, names.params) || '（値なし）';
    detail = [item.reading.method && measureMethodLabels[item.reading.method], item.reading.memo].filter(Boolean).join(' ・ ');
    editTo = `/water/${item.reading.id}/edit`;
    owner = 'water';
    remove = () => deleteWaterReading(db, item.reading.id);
  } else if (item.kind === 'maintenance') {
    const l = item.log;
    title = `${maintenanceTypeLabels[l.type]}${l.amount !== undefined ? ` ${l.amount}${l.unit ?? ''}` : ''}`;
    detail = l.memo ?? '';
    editTo = `/maintenance/${l.id}/edit`;
    owner = 'maintenance';
    remove = () => deleteMaintenanceLog(db, l.id);
  } else {
    const l = item.log;
    const isFish = l.target_type === 'livestock';
    const name = (isFish ? names.livestock : names.plant).get(l.target_id) ?? '';
    const status = isFish ? livestockStatusLabels[l.status as LivestockStatus] : plantStatusLabels[l.status as PlantStatus];
    title = `${name}：${status}`;
    detail = [
      l.symptoms.join('、'),
      l.length_cm !== undefined && `体長 ${l.length_cm}cm`,
      l.weight_g !== undefined && `体重 ${l.weight_g}g`,
      l.treatment && `対処: ${l.treatment}`,
      l.trimmed && `トリミング${l.trim_amount ? `（${l.trim_amount}）` : ''}`,
      l.fertilized && `追肥${l.fertilizer ? `（${l.fertilizer}）` : ''}`,
      l.memo,
    ]
      .filter(Boolean)
      .join(' ・ ');
    editTo = `/condition/${l.id}/edit`;
    owner = 'condition';
    remove = () => deleteConditionLog(db, l.id);
  }
  const id = item.kind === 'water' ? item.reading.id : item.log.id;

  return (
    <li className="mb-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
        <Badge tone={kindTone[item.kind]}>{kindLabel[item.kind]}</Badge>
        <span>{fmtDateTime(item.at)}</span>
        {showTank && <span className="truncate">{names.tank.get(item.tank_id)}</span>}
        <span className="ml-auto flex gap-3">
          <Link to={editTo} className="text-teal-700">
            編集
          </Link>
          <button
            type="button"
            className="text-red-600"
            onClick={() => {
              if (confirm('この記録を削除しますか？（添付写真も消えます）')) remove();
            }}
          >
            削除
          </button>
        </span>
      </div>
      <p className="font-bold">{title}</p>
      {detail && <p className="text-sm text-slate-600">{detail}</p>}
      <div className="mt-1">
        <OwnerPhotos owner={owner} id={id} size="h-14 w-14" />
      </div>
    </li>
  );
}

export function TimelineList({ items, showTank = false, empty = 'まだ記録がありません' }: { items?: TimelineItem[]; showTank?: boolean; empty?: string }) {
  const names = useNames();
  if (!items || !names) return null;
  if (!items.length) return <Empty>{empty}</Empty>;
  return (
    <ul>
      {items.map((item) => (
        <Row key={`${item.kind}-${item.kind === 'water' ? item.reading.id : item.log.id}`} item={item} names={names} showTank={showTank} />
      ))}
    </ul>
  );
}
