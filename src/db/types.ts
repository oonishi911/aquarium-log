// 要件定義書 7章のデータモデルに対応する型。ステップ3で残りを追加する

export type Timestamps = {
  created_at: string; // ISO 8601
  updated_at: string;
};

export type TankStatus = 'active' | 'paused' | 'removed';

export type Tank = Timestamps & {
  id: string;
  name: string;
  status: TankStatus;
};

export type WaterParameter = {
  id: string;
  key: string; // temp, ph, kh, gh, nh3, no2, no3, tds ...
  label: string;
  unit: string;
  decimals: number;
  visible: boolean;
};
