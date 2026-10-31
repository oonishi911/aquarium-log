// バックアップの書き出し・読み込み。写真は base64 にして 1つの JSON に入れる
import { SCHEMA_VERSION, type AquariumDB } from './db';
import type { Photo } from './types';

export const BACKUP_FORMAT = 1;

type PhotoJson = Omit<Photo, 'blob'> & { blob_type: string; blob_base64: string };

export type Backup = {
  app: 'aquarium-log';
  format: number;
  schema_version: number;
  exported_at: string;
  tables: Record<string, unknown[]>;
  photos: PhotoJson[];
};

// 写真以外のテーブル名
const plainTables = [
  'tanks',
  'species',
  'livestock',
  'plants',
  'conditionLogs',
  'movementLogs',
  'waterParameters',
  'waterReadings',
  'waterValues',
  'maintenanceLogs',
  'maintenanceTemplates',
  'tankRanges',
  'colorAnalyses',
  'settings',
] as const;

function bytesToBase64(bytes: Uint8Array) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

function base64ToBytes(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function exportBackup(db: AquariumDB): Promise<Backup> {
  const tables: Record<string, unknown[]> = {};
  for (const name of plainTables) tables[name] = await db.table(name).toArray();
  const photos: PhotoJson[] = [];
  for (const p of await db.photos.toArray()) {
    const { blob, ...rest } = p;
    photos.push({ ...rest, blob_type: blob.type, blob_base64: bytesToBase64(new Uint8Array(await blob.arrayBuffer())) });
  }
  return { app: 'aquarium-log', format: BACKUP_FORMAT, schema_version: SCHEMA_VERSION, exported_at: new Date().toISOString(), tables, photos };
}

export function backupFileName(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `aquarium-log-backup-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}.json`;
}

// 端末内のデータをすべてバックアップの内容に置き換える
export async function importBackup(db: AquariumDB, data: unknown) {
  const b = data as Backup;
  if (!b || b.app !== 'aquarium-log' || typeof b.tables !== 'object') throw new Error('このアプリのバックアップファイルではありません');
  if (b.format > BACKUP_FORMAT) throw new Error('新しいバージョンのアプリで作られたファイルです。アプリを更新してください');

  const tables = [...plainTables.map((n) => db.table(n)), db.photos];
  await db.transaction('rw', tables, async () => {
    for (const name of plainTables) {
      await db.table(name).clear();
      const rows = b.tables[name];
      if (Array.isArray(rows) && rows.length) await db.table(name).bulkAdd(rows);
    }
    await db.photos.clear();
    for (const { blob_type, blob_base64, ...rest } of b.photos ?? []) {
      await db.photos.add({ ...rest, blob: new Blob([base64ToBytes(blob_base64)], { type: blob_type }) });
    }
  });
}
