// 要件定義書 7章のデータモデルに対応する型

export type Timestamps = {
  created_at: string; // ISO 8601
  updated_at: string;
};

export type TankStatus = 'active' | 'paused' | 'removed';
export type FilterType = 'external' | 'top' | 'hang_on' | 'sponge' | 'undergravel' | 'other';

export type Tank = Timestamps & {
  id: string;
  name: string;
  status: TankStatus;
  width_cm?: number;
  depth_cm?: number;
  height_cm?: number;
  volume_l?: number;
  started_on?: string; // YYYY-MM-DD
  filter_type?: FilterType;
  lighting?: string;
  co2?: string; // 空ならなし
  substrate?: string;
  heater_temp?: number;
  memo?: string;
  cover_photo_id?: string;
};

export type SpeciesKind = 'fish' | 'shrimp' | 'snail' | 'plant' | 'other';

export type Species = {
  id: string;
  kind: SpeciesKind;
  name: string;
  memo?: string;
};

export type LivestockUnit = 'group' | 'individual';
export type Sex = 'male' | 'female' | 'unknown';
export type LivestockStatus = 'healthy' | 'watch' | 'treating' | 'isolated' | 'dead' | 'transferred';

export type Livestock = Timestamps & {
  id: string;
  tank_id: string;
  species_id: string;
  unit: LivestockUnit;
  nickname?: string;
  count: number; // 個体管理は常に1
  sex?: Sex;
  partner_id?: string;
  acquired_on?: string;
  source?: string;
  price?: number;
  status: LivestockStatus;
  memo?: string;
};

export type PlantPosition = 'foreground' | 'midground' | 'background' | 'epiphyte' | 'floating';
export type PlantStatus = 'good' | 'watch' | 'poor' | 'removed';

export type Plant = Timestamps & {
  id: string;
  tank_id: string;
  species_id: string;
  planted_on?: string;
  source?: string;
  position?: PlantPosition;
  status: PlantStatus;
  memo?: string;
};

export type ConditionTarget = 'livestock' | 'plant';

// 生体・水草共通の状態記録。項目は対象により使い分ける
export type ConditionLog = Timestamps & {
  id: string;
  target_type: ConditionTarget;
  target_id: string;
  tank_id: string; // 一覧表示用に記録時点の水槽を持つ
  logged_at: string;
  status: LivestockStatus | PlantStatus;
  symptoms: string[];
  length_cm?: number;
  weight_g?: number;
  treatment?: string;
  trimmed?: boolean;
  trim_amount?: string;
  fertilized?: boolean;
  fertilizer?: string;
  memo?: string;
};

// 生体の移動・増減履歴
export type MovementLog = {
  id: string;
  livestock_id: string;
  logged_at: string;
  from_tank_id?: string;
  to_tank_id?: string;
  count_change?: number;
  reason?: string;
};

export type WaterParameter = {
  id: string;
  key: string; // temp, ph, kh, gh, nh3, no2, no3, tds ...
  label: string;
  unit: string;
  decimals: number;
  visible: boolean;
  sort: number;
};

export type MeasureMethod = 'strip' | 'reagent' | 'meter';

export type WaterReading = Timestamps & {
  id: string;
  tank_id: string;
  measured_at: string;
  method?: MeasureMethod;
  memo?: string;
  source: 'manual' | 'sensor';
};

export type WaterValue = {
  id: string;
  reading_id: string;
  parameter_id: string;
  value: number;
};

export type MaintenanceType =
  | 'water_change'
  | 'filter_clean'
  | 'feeding'
  | 'additive'
  | 'medication'
  | 'trimming'
  | 'substrate_clean'
  | 'equipment'
  | 'other';

export type MaintenanceLog = Timestamps & {
  id: string;
  tank_id: string;
  done_at: string;
  type: MaintenanceType;
  amount?: number;
  unit?: '%' | 'L' | string;
  memo?: string;
};

export type MaintenanceTemplate = Timestamps & {
  id: string;
  name: string;
  type: MaintenanceType;
  amount?: number;
  unit?: string;
  memo?: string;
  interval_days?: number;
};

export type PhotoOwner = 'tank' | 'livestock' | 'plant' | 'condition' | 'water' | 'maintenance';

export type Photo = {
  id: string;
  owner_type: PhotoOwner;
  owner_id: string;
  tank_id: string;
  taken_at: string;
  blob: Blob;
  width: number;
  height: number;
  condition_ok?: boolean;
  condition_memo?: string;
  created_at: string;
};

// 注意範囲（水槽ごと・項目ごと）。片側だけの指定もできる
export type TankRange = {
  tank_id: string;
  parameter_id: string;
  min?: number;
  max?: number;
};

// 水草の色分類のしきい値（色相は 0〜360°、彩度・明度は 0〜1）
export type ColorThresholds = {
  greenMin: number;
  greenMax: number;
  yellowMin: number; // 黄は yellowMin〜greenMin
  brownMin: number; // 茶は brownMin〜yellowMin かつ明度 brownMaxV 以下
  brownMaxV: number;
  minS: number; // これより彩度が低い画素（影・砂・ガラス）は集計から除外
  minV: number; // これより暗い画素は除外
  maxV: number; // これより明るく、彩度も低い画素（反射）は除外
};

// 写真上で選んだ範囲。座標は画像の幅・高さに対する 0〜1 の割合
export type ColorRegion =
  | { shape: 'rect'; x: number; y: number; w: number; h: number }
  | { shape: 'lasso'; points: [number, number][] };

export type ColorAnalysis = Timestamps & {
  id: string;
  plant_id: string;
  tank_id: string;
  photo_id: string;
  taken_at: string; // 写真の撮影日時。比較の順番はこれで決める
  region: ColorRegion;
  green_pct: number;
  yellow_pct: number;
  brown_pct: number;
  other_pct: number;
  excluded_pct: number; // 範囲内で集計から外した画素の割合（参考）
  condition_ok: boolean; // 撮影ルールを守れたか
  condition_memo?: string;
  compared_with_id?: string;
  generated_text: string;
  settings_snapshot: ColorThresholds;
};

// アプリ設定（キー・値）。バックアップに含めるため DB に置く
export type AppSetting = { key: string; value: unknown };
