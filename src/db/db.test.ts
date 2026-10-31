import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exportBackup, importBackup } from './backup';
import { AquariumDB } from './db';
import {
  ensureDefaults,
  findOrCreateSpecies,
  getColorThresholds,
  previousAnalysis,
  saveColorAnalysis,
  saveColorThresholds,
  saveConditionLog,
  saveLivestock,
  saveMaintenanceLog,
  saveTank,
  saveTankRange,
  saveWaterReading,
  tankRanges,
  tankSummary,
  timeline,
  waterSeries,
} from './repo';
import { defaultThresholds } from '../lib/color';

let db: AquariumDB;
let n = 0;

beforeEach(async () => {
  db = new AquariumDB(`test-db-${n++}`);
  await ensureDefaults(db);
});
afterEach(() => db.close());

const tank = () => saveTank(db, { name: 'リビング60cm', status: 'active' });

describe('初期値', () => {
  it('水質項目は水温と pH だけ表示、作業テンプレートが1件入る', async () => {
    const visible = (await db.waterParameters.toArray()).filter((p) => p.visible).map((p) => p.key);
    expect(visible.sort()).toEqual(['ph', 'temp']);
    expect(await db.maintenanceTemplates.count()).toBe(1);
  });

  it('2回目以降は設定を上書きしない', async () => {
    await db.waterParameters.update('kh', { visible: true });
    await db.maintenanceTemplates.clear();
    await ensureDefaults(db);
    expect((await db.waterParameters.get('kh'))?.visible).toBe(true);
    expect(await db.maintenanceTemplates.count()).toBe(0);
  });
});

describe('生体', () => {
  it('導入と数の増減・水槽移動を履歴に残す', async () => {
    const t1 = await tank();
    const t2 = await saveTank(db, { name: '隔離30cm', status: 'active' });
    const sp = await findOrCreateSpecies(db, 'fish', ' ネオンテトラ ');
    const fish = await saveLivestock(db, { tank_id: t1.id, species_id: sp.id, unit: 'group', count: 10, status: 'healthy' });
    await saveLivestock(db, { ...fish, count: 8 }, '2匹死亡');
    await saveLivestock(db, { ...fish, count: 8, tank_id: t2.id });

    // 同じミリ秒に保存されることがあるので順序には頼らない
    const logs = await db.movementLogs.where('livestock_id').equals(fish.id).toArray();
    expect(logs).toHaveLength(3);
    expect(logs.find((l) => l.count_change === -2)?.reason).toBe('2匹死亡');
    expect(logs.find((l) => l.to_tank_id === t2.id)?.from_tank_id).toBe(t1.id);
    expect((await findOrCreateSpecies(db, 'fish', 'ネオンテトラ')).id).toBe(sp.id);
  });

  it('ペア相手を双方向にひもづけ、相手を変えると古い側を外す', async () => {
    const t = await tank();
    const sp = await findOrCreateSpecies(db, 'fish', 'アピストグラマ');
    const base = { tank_id: t.id, species_id: sp.id, unit: 'individual' as const, count: 1, status: 'healthy' as const };
    const male = await saveLivestock(db, { ...base, nickname: 'オス1', sex: 'male' });
    const female1 = await saveLivestock(db, { ...base, nickname: 'メス1', sex: 'female', partner_id: male.id });
    expect((await db.livestock.get(male.id))?.partner_id).toBe(female1.id);

    const female2 = await saveLivestock(db, { ...base, nickname: 'メス2', sex: 'female', partner_id: male.id });
    expect((await db.livestock.get(male.id))?.partner_id).toBe(female2.id);
    expect((await db.livestock.get(female1.id))?.partner_id).toBeUndefined();
  });

  it('最新の状態記録で生体の状態が変わる', async () => {
    const t = await tank();
    const sp = await findOrCreateSpecies(db, 'fish', 'グッピー');
    const fish = await saveLivestock(db, { tank_id: t.id, species_id: sp.id, unit: 'group', count: 5, status: 'healthy' });
    await saveConditionLog(db, { target_type: 'livestock', target_id: fish.id, tank_id: t.id, logged_at: '2026-10-30T10:00:00.000Z', status: 'treating', symptoms: ['白点'] });
    // 過去日の記録を後から入れても、最新の状態は変わらない
    await saveConditionLog(db, { target_type: 'livestock', target_id: fish.id, tank_id: t.id, logged_at: '2026-10-01T10:00:00.000Z', status: 'healthy', symptoms: [] });
    expect((await db.livestock.get(fish.id))?.status).toBe('treating');
  });
});

describe('記録', () => {
  it('水質と換水が水槽カードと記録一覧に出る', async () => {
    const t = await tank();
    await saveWaterReading(db, { tank_id: t.id, measured_at: '2026-10-29T10:00:00.000Z', source: 'manual' }, { temp: 25.5, ph: 6.8 });
    await saveWaterReading(db, { tank_id: t.id, measured_at: '2026-10-30T10:00:00.000Z', source: 'manual' }, { temp: 26.1 });
    await saveMaintenanceLog(db, { tank_id: t.id, done_at: '2026-10-28T09:00:00.000Z', type: 'water_change', amount: 33, unit: '%' });

    const s = await tankSummary(db, t.id);
    expect(s.latest.temp.value).toBe(26.1);
    expect(s.latest.ph.value).toBe(6.8);
    expect(s.lastWaterChange).toBe('2026-10-28T09:00:00.000Z');

    const items = await timeline(db, t.id);
    expect(items.map((i) => i.kind)).toEqual(['water', 'water', 'maintenance']);
  });
});

describe('バックアップ', () => {
  it('書き出した内容を別の端末（DB）に読み込める。写真も戻る', async () => {
    const t = await tank();
    await saveWaterReading(db, { tank_id: t.id, measured_at: '2026-10-30T10:00:00.000Z', source: 'manual' }, { temp: 26 });
    const bytes = new Uint8Array([1, 2, 3, 250]);
    await db.photos.add({ id: 'p1', owner_type: 'tank', owner_id: t.id, tank_id: t.id, taken_at: '2026-10-30T10:00:00.000Z', blob: new Blob([bytes], { type: 'image/jpeg' }), width: 1, height: 1, created_at: '2026-10-30T10:00:00.000Z' });

    const json = JSON.parse(JSON.stringify(await exportBackup(db)));
    const other = new AquariumDB(`test-db-${n++}`);
    await importBackup(other, json);
    expect((await other.tanks.get(t.id))?.name).toBe('リビング60cm');
    expect(await other.waterValues.count()).toBe(1);
    const photo = await other.photos.get('p1');
    expect(new Uint8Array(await photo!.blob.arrayBuffer())).toEqual(bytes);
    other.close();
  });

  it('関係ないファイルは読み込まない', async () => {
    await expect(importBackup(db, { foo: 1 })).rejects.toThrow('バックアップファイルではありません');
  });
});

describe('グラフと注意範囲', () => {
  it('項目ごとの推移（古い順）と換水日を返す', async () => {
    const t = await tank();
    await saveWaterReading(db, { tank_id: t.id, measured_at: '2026-10-30T10:00:00.000Z', source: 'manual' }, { temp: 26.1, ph: 6.5 });
    await saveWaterReading(db, { tank_id: t.id, measured_at: '2026-10-29T10:00:00.000Z', source: 'manual' }, { temp: 25.5 });
    await saveMaintenanceLog(db, { tank_id: t.id, done_at: '2026-10-29T12:00:00.000Z', type: 'water_change' });
    await saveMaintenanceLog(db, { tank_id: t.id, done_at: '2026-10-29T13:00:00.000Z', type: 'feeding' });
    const { series, waterChanges } = await waterSeries(db, t.id);
    expect(series.temp.map((p) => p.value)).toEqual([25.5, 26.1]);
    expect(series.ph).toHaveLength(1);
    expect(waterChanges).toEqual(['2026-10-29T12:00:00.000Z']);
  });

  it('注意範囲は水槽ごとに保存し、両方空なら初期値に戻す', async () => {
    const t = await tank();
    await saveTankRange(db, { tank_id: t.id, parameter_id: 'temp', min: 22, max: 25 });
    expect(await tankRanges(db, t.id)).toEqual([{ tank_id: t.id, parameter_id: 'temp', min: 22, max: 25 }]);
    await saveTankRange(db, { tank_id: t.id, parameter_id: 'temp' });
    expect(await tankRanges(db, t.id)).toEqual([]);
  });
});

describe('色変化レポート', () => {
  const analysis = (plant_id: string, taken_at: string) => ({
    plant_id,
    tank_id: 't',
    photo_id: `photo-${taken_at}`,
    taken_at,
    region: { shape: 'rect' as const, x: 0, y: 0, w: 1, h: 1 },
    green_pct: 60,
    yellow_pct: 20,
    brown_pct: 10,
    other_pct: 10,
    excluded_pct: 5,
    condition_ok: true,
    generated_text: '',
    settings_snapshot: defaultThresholds,
  });

  it('比較相手はその写真より前の最新の分析', async () => {
    const a1 = await saveColorAnalysis(db, analysis('p1', '2026-10-01T10:00:00.000Z'));
    const a2 = await saveColorAnalysis(db, analysis('p1', '2026-10-15T10:00:00.000Z'));
    await saveColorAnalysis(db, analysis('p2', '2026-10-20T10:00:00.000Z'));
    expect((await previousAnalysis(db, 'p1', '2026-10-30T10:00:00.000Z'))?.id).toBe(a2.id);
    expect((await previousAnalysis(db, 'p1', '2026-10-10T10:00:00.000Z'))?.id).toBe(a1.id);
    expect(await previousAnalysis(db, 'p1', '2026-09-01T10:00:00.000Z')).toBeUndefined();
  });

  it('しきい値は保存がなければ初期値', async () => {
    expect(await getColorThresholds(db)).toEqual(defaultThresholds);
    await saveColorThresholds(db, { ...defaultThresholds, greenMin: 65 });
    expect((await getColorThresholds(db)).greenMin).toBe(65);
  });

  it('バックアップに注意範囲・色分析・設定も入る', async () => {
    await saveTankRange(db, { tank_id: 't', parameter_id: 'ph', min: 6, max: 7 });
    await saveColorAnalysis(db, analysis('p1', '2026-10-01T10:00:00.000Z'));
    await saveColorThresholds(db, { ...defaultThresholds, minS: 0.2 });
    const json = JSON.parse(JSON.stringify(await exportBackup(db)));
    const other = new AquariumDB(`test-db-${n++}`);
    await importBackup(other, json);
    expect(await other.tankRanges.count()).toBe(1);
    expect(await other.colorAnalyses.count()).toBe(1);
    expect((await getColorThresholds(other)).minS).toBe(0.2);
    other.close();
  });
});

describe('データ形式の移行', () => {
  it('v2 の記録を残したまま v3 に上がる', async () => {
    const name = `test-db-${n++}`;
    const old = new Dexie(name);
    old.version(2).stores({ tanks: 'id, status, updated_at', waterParameters: 'id, &key, sort' });
    await old.table('tanks').add({ id: 'old', name: '古い水槽', status: 'active', created_at: '', updated_at: '' });
    old.close();

    const upgraded = new AquariumDB(name);
    expect((await upgraded.tanks.get('old'))?.name).toBe('古い水槽');
    expect(await upgraded.colorAnalyses.count()).toBe(0);
    upgraded.close();
  });
});
