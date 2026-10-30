import Dexie, { type Table } from 'dexie';
import type { Tank, WaterParameter } from './types';

export const DB_NAME = 'aquarium-log';
// データ形式を変えるときはここを上げ、version().upgrade() で自動移行する
export const SCHEMA_VERSION = 1;

export class AquariumDB extends Dexie {
  tanks!: Table<Tank, string>;
  waterParameters!: Table<WaterParameter, string>;

  constructor(name = DB_NAME) {
    super(name);
    // 他のテーブル（生体・水草・記録・写真など）はステップ3で追加する
    this.version(SCHEMA_VERSION).stores({
      tanks: 'id, status, updated_at',
      waterParameters: 'id, &key',
    });
  }
}

export const db = new AquariumDB();
