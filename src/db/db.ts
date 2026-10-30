import Dexie, { type Table } from 'dexie';
import type {
  ConditionLog,
  Livestock,
  MaintenanceLog,
  MaintenanceTemplate,
  MovementLog,
  Photo,
  Plant,
  Species,
  Tank,
  WaterParameter,
  WaterReading,
  WaterValue,
} from './types';

export const DB_NAME = 'aquarium-log';
// データ形式を変えるときはここを上げ、version().upgrade() で自動移行する
export const SCHEMA_VERSION = 2;

export class AquariumDB extends Dexie {
  tanks!: Table<Tank, string>;
  species!: Table<Species, string>;
  livestock!: Table<Livestock, string>;
  plants!: Table<Plant, string>;
  conditionLogs!: Table<ConditionLog, string>;
  movementLogs!: Table<MovementLog, string>;
  waterParameters!: Table<WaterParameter, string>;
  waterReadings!: Table<WaterReading, string>;
  waterValues!: Table<WaterValue, string>;
  maintenanceLogs!: Table<MaintenanceLog, string>;
  maintenanceTemplates!: Table<MaintenanceTemplate, string>;
  photos!: Table<Photo, string>;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores({
      tanks: 'id, status, updated_at',
      waterParameters: 'id, &key',
    });
    this.version(SCHEMA_VERSION).stores({
      tanks: 'id, status, updated_at',
      species: 'id, kind, name',
      livestock: 'id, tank_id, species_id, status',
      plants: 'id, tank_id, species_id, status',
      conditionLogs: 'id, [target_type+target_id], tank_id, logged_at',
      movementLogs: 'id, livestock_id, logged_at',
      waterParameters: 'id, &key, sort',
      waterReadings: 'id, tank_id, measured_at',
      waterValues: 'id, reading_id, parameter_id',
      maintenanceLogs: 'id, tank_id, done_at, type',
      maintenanceTemplates: 'id, name',
      photos: 'id, [owner_type+owner_id], tank_id, taken_at',
    });
  }
}

export const db = new AquariumDB();
