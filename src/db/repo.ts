// 画面から使うデータ操作。テストしやすいよう DB インスタンスを引数で受け取る
import type { AquariumDB } from './db';
import { defaultWaterParameters } from './labels';
import type {
  ConditionLog,
  Livestock,
  MaintenanceLog,
  MaintenanceTemplate,
  Photo,
  Plant,
  SpeciesKind,
  Tank,
  WaterReading,
} from './types';

export const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

type Draft<T> = Omit<T, 'id' | 'created_at' | 'updated_at'> & { id?: string };

// 初回起動時に水質項目と作業テンプレートの初期値を入れる。既存の値は上書きしない
export async function ensureDefaults(db: AquariumDB) {
  await db.transaction('rw', db.waterParameters, db.maintenanceTemplates, async () => {
    const firstRun = (await db.waterParameters.count()) === 0;
    for (const p of defaultWaterParameters) {
      if (!(await db.waterParameters.get(p.id))) await db.waterParameters.add(p);
    }
    if (firstRun && (await db.maintenanceTemplates.count()) === 0) {
      const now = nowIso();
      await db.maintenanceTemplates.add({
        id: newId(),
        name: '1/3換水＋カルキ抜き',
        type: 'water_change',
        amount: 33,
        unit: '%',
        memo: 'カルキ抜き使用',
        interval_days: 7,
        created_at: now,
        updated_at: now,
      });
    }
  });
}

async function upsert<T extends { id: string; created_at: string; updated_at: string }>(
  table: { get(id: string): Promise<T | undefined>; put(item: T): Promise<unknown> },
  draft: Draft<T>,
): Promise<T> {
  const now = nowIso();
  const existing = draft.id ? await table.get(draft.id) : undefined;
  const item = {
    ...draft,
    id: draft.id ?? newId(),
    created_at: existing?.created_at ?? now,
    updated_at: now,
  } as T;
  await table.put(item);
  return item;
}

export const saveTank = (db: AquariumDB, draft: Draft<Tank>) => upsert<Tank>(db.tanks, draft);

// 種類名から種類マスタを引く。なければ作る（表記ゆれを避けるため前後の空白は除く）
export async function findOrCreateSpecies(db: AquariumDB, kind: SpeciesKind, rawName: string) {
  const name = rawName.trim();
  const found = await db.species.where('name').equals(name).first();
  if (found) return found;
  const species = { id: newId(), kind, name };
  await db.species.add(species);
  return species;
}

// 生体の保存。導入・水槽移動・数の増減は MovementLog に残し、ペア相手は双方向にひもづける
export async function saveLivestock(db: AquariumDB, draft: Draft<Livestock>, reason?: string) {
  return db.transaction('rw', db.livestock, db.movementLogs, async () => {
    const before = draft.id ? await db.livestock.get(draft.id) : undefined;
    const input = { ...draft, count: draft.unit === 'individual' ? 1 : draft.count };
    if (input.unit !== 'individual') input.partner_id = undefined;
    const item = await upsert<Livestock>(db.livestock, input);
    const logged_at = nowIso();

    if (!before) {
      await db.movementLogs.add({
        id: newId(),
        livestock_id: item.id,
        logged_at,
        to_tank_id: item.tank_id,
        count_change: item.count,
        reason: reason || '導入',
      });
    } else {
      const moved = before.tank_id !== item.tank_id;
      const diff = item.count - before.count;
      if (moved || diff !== 0) {
        await db.movementLogs.add({
          id: newId(),
          livestock_id: item.id,
          logged_at,
          from_tank_id: moved ? before.tank_id : undefined,
          to_tank_id: moved ? item.tank_id : undefined,
          count_change: diff || undefined,
          reason,
        });
      }
    }

    if (before?.partner_id !== item.partner_id) {
      if (before?.partner_id) {
        const old = await db.livestock.get(before.partner_id);
        if (old?.partner_id === item.id) await db.livestock.update(old.id, { partner_id: undefined, updated_at: logged_at });
      }
      if (item.partner_id) {
        const partner = await db.livestock.get(item.partner_id);
        if (partner) {
          // 相手に別のペアがいた場合はそちらのひもづけを外す
          if (partner.partner_id && partner.partner_id !== item.id) {
            await db.livestock.update(partner.partner_id, { partner_id: undefined, updated_at: logged_at });
          }
          await db.livestock.update(partner.id, { partner_id: item.id, updated_at: logged_at });
        }
      }
    }
    return item;
  });
}

export const savePlant = (db: AquariumDB, draft: Draft<Plant>) => upsert<Plant>(db.plants, draft);

// 状態記録を保存し、それが最新の記録なら生体・水草本体の状態も合わせる
export async function saveConditionLog(db: AquariumDB, draft: Draft<ConditionLog>) {
  return db.transaction('rw', db.conditionLogs, db.livestock, db.plants, async () => {
    const item = await upsert<ConditionLog>(db.conditionLogs, draft);
    const logs = await db.conditionLogs.where('[target_type+target_id]').equals([item.target_type, item.target_id]).toArray();
    const latest = logs.reduce((a, b) => (b.logged_at > a.logged_at ? b : a));
    if (latest.id === item.id) {
      const table = item.target_type === 'livestock' ? db.livestock : db.plants;
      await table.update(item.target_id, { status: item.status, updated_at: nowIso() } as never);
    }
    return item;
  });
}

// 1回の測定を保存。values は parameter_id → 値（未入力の項目は入れない）
export async function saveWaterReading(db: AquariumDB, draft: Draft<WaterReading>, values: Record<string, number>) {
  return db.transaction('rw', db.waterReadings, db.waterValues, async () => {
    const item = await upsert<WaterReading>(db.waterReadings, draft);
    await db.waterValues.where('reading_id').equals(item.id).delete();
    await db.waterValues.bulkAdd(
      Object.entries(values).map(([parameter_id, value]) => ({ id: newId(), reading_id: item.id, parameter_id, value })),
    );
    return item;
  });
}

export const saveMaintenanceLog = (db: AquariumDB, draft: Draft<MaintenanceLog>) =>
  upsert<MaintenanceLog>(db.maintenanceLogs, draft);

export const saveMaintenanceTemplate = (db: AquariumDB, draft: Draft<MaintenanceTemplate>) =>
  upsert<MaintenanceTemplate>(db.maintenanceTemplates, draft);

export async function addPhoto(db: AquariumDB, photo: Omit<Photo, 'id' | 'created_at'>) {
  const item: Photo = { ...photo, id: newId(), created_at: nowIso() };
  await db.photos.add(item);
  return item;
}

export async function photosOf(db: AquariumDB, owner_type: Photo['owner_type'], owner_id: string) {
  return db.photos.where('[owner_type+owner_id]').equals([owner_type, owner_id]).sortBy('taken_at');
}

const deletePhotosOf = (db: AquariumDB, owner_type: Photo['owner_type'], owner_id: string) =>
  db.photos.where('[owner_type+owner_id]').equals([owner_type, owner_id]).delete();

// 記録の削除（入力ミスの取り消し用）。添付写真もいっしょに消す
export async function deleteConditionLog(db: AquariumDB, id: string) {
  await db.transaction('rw', db.conditionLogs, db.photos, async () => {
    await db.conditionLogs.delete(id);
    await deletePhotosOf(db, 'condition', id);
  });
}

export async function deleteWaterReading(db: AquariumDB, id: string) {
  await db.transaction('rw', db.waterReadings, db.waterValues, db.photos, async () => {
    await db.waterReadings.delete(id);
    await db.waterValues.where('reading_id').equals(id).delete();
    await deletePhotosOf(db, 'water', id);
  });
}

export async function deleteMaintenanceLog(db: AquariumDB, id: string) {
  await db.transaction('rw', db.maintenanceLogs, db.photos, async () => {
    await db.maintenanceLogs.delete(id);
    await deletePhotosOf(db, 'maintenance', id);
  });
}

// 記録一覧用: 水質・作業・状態記録を新しい順にまとめる
export type TimelineItem =
  | { kind: 'water'; at: string; tank_id: string; reading: WaterReading; values: Record<string, number> }
  | { kind: 'maintenance'; at: string; tank_id: string; log: MaintenanceLog }
  | { kind: 'condition'; at: string; tank_id: string; log: ConditionLog };

export async function timeline(db: AquariumDB, tankId?: string): Promise<TimelineItem[]> {
  const byTank = <T>(table: { where(i: string): { equals(v: string): { toArray(): Promise<T[]> } }; toArray(): Promise<T[]> }) =>
    tankId ? table.where('tank_id').equals(tankId).toArray() : table.toArray();

  const [readings, maints, conds] = await Promise.all([
    byTank<WaterReading>(db.waterReadings),
    byTank<MaintenanceLog>(db.maintenanceLogs),
    byTank<ConditionLog>(db.conditionLogs),
  ]);
  const values = await db.waterValues.where('reading_id').anyOf(readings.map((r) => r.id)).toArray();
  const valueMap = new Map<string, Record<string, number>>();
  for (const v of values) {
    const m = valueMap.get(v.reading_id) ?? {};
    m[v.parameter_id] = v.value;
    valueMap.set(v.reading_id, m);
  }

  const items: TimelineItem[] = [
    ...readings.map((r) => ({ kind: 'water' as const, at: r.measured_at, tank_id: r.tank_id, reading: r, values: valueMap.get(r.id) ?? {} })),
    ...maints.map((l) => ({ kind: 'maintenance' as const, at: l.done_at, tank_id: l.tank_id, log: l })),
    ...conds.map((l) => ({ kind: 'condition' as const, at: l.logged_at, tank_id: l.tank_id, log: l })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

export async function conditionTimeline(db: AquariumDB, target_type: ConditionLog['target_type'], target_id: string): Promise<TimelineItem[]> {
  const logs = await db.conditionLogs.where('[target_type+target_id]').equals([target_type, target_id]).toArray();
  return logs
    .sort((a, b) => b.logged_at.localeCompare(a.logged_at))
    .map((log) => ({ kind: 'condition' as const, at: log.logged_at, tank_id: log.tank_id, log }));
}

// ホームの水槽カード用: 最新の水温・pH と最終換水日
export async function tankSummary(db: AquariumDB, tankId: string) {
  const readings = await db.waterReadings.where('tank_id').equals(tankId).sortBy('measured_at');
  const latest: Record<string, { value: number; at: string }> = {};
  for (const r of readings.reverse()) {
    const vals = await db.waterValues.where('reading_id').equals(r.id).toArray();
    for (const v of vals) if (!latest[v.parameter_id]) latest[v.parameter_id] = { value: v.value, at: r.measured_at };
    if (latest.temp && latest.ph) break;
  }
  const changes = await db.maintenanceLogs.where('tank_id').equals(tankId).filter((l) => l.type === 'water_change').sortBy('done_at');
  return { latest, lastWaterChange: changes[changes.length - 1]?.done_at };
}
