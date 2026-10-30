// 画面に出す日本語ラベル。選択肢の並び順もここで決める
import type {
  FilterType,
  LivestockStatus,
  LivestockUnit,
  MaintenanceType,
  MeasureMethod,
  PlantPosition,
  PlantStatus,
  Sex,
  SpeciesKind,
  TankStatus,
  WaterParameter,
} from './types';

export const tankStatusLabels: Record<TankStatus, string> = {
  active: '稼働中',
  paused: '休止',
  removed: '撤去',
};

export const filterTypeLabels: Record<FilterType, string> = {
  external: '外部',
  top: '上部',
  hang_on: '外掛け',
  sponge: 'スポンジ',
  undergravel: '底面',
  other: 'その他',
};

export const speciesKindLabels: Record<SpeciesKind, string> = {
  fish: '魚',
  shrimp: 'エビ',
  snail: '貝',
  plant: '水草',
  other: 'その他',
};

export const unitLabels: Record<LivestockUnit, string> = {
  group: '群れ',
  individual: '個体',
};

export const sexLabels: Record<Sex, string> = {
  male: 'オス',
  female: 'メス',
  unknown: '不明',
};

export const livestockStatusLabels: Record<LivestockStatus, string> = {
  healthy: '元気',
  watch: '様子見',
  treating: '治療中',
  isolated: '隔離中',
  dead: '死亡',
  transferred: '譲渡',
};

export const plantStatusLabels: Record<PlantStatus, string> = {
  good: '良好',
  watch: '様子見',
  poor: '不調',
  removed: '撤去',
};

export const plantPositionLabels: Record<PlantPosition, string> = {
  foreground: '前景',
  midground: '中景',
  background: '後景',
  epiphyte: '活着',
  floating: '浮草',
};

export const livestockSymptoms = ['食欲低下', '白点', 'ヒレの傷み', '痩せ', '体色変化', '泳ぎ異常', 'その他'];
export const plantSymptoms = ['黄化', '茶色化', '溶け', 'コケ付着', '成長停滞', 'その他'];

export const maintenanceTypeLabels: Record<MaintenanceType, string> = {
  water_change: '換水',
  filter_clean: 'フィルター掃除',
  feeding: '給餌',
  additive: '添加剤',
  medication: '投薬',
  trimming: 'トリミング',
  substrate_clean: '底床掃除',
  equipment: '機材交換',
  other: 'その他',
};

export const measureMethodLabels: Record<MeasureMethod, string> = {
  strip: '試験紙',
  reagent: '試薬',
  meter: '電子機器',
};

// 生体・水草で「注意が必要」とみなす状態
export const attentionLivestock: LivestockStatus[] = ['watch', 'treating', 'isolated'];
export const attentionPlant: PlantStatus[] = ['watch', 'poor'];
export const inactiveLivestock: LivestockStatus[] = ['dead', 'transferred'];

// 初期の水質項目。普段測る水温と pH だけ表示し、他は設定で ON にする
export const defaultWaterParameters: WaterParameter[] = [
  { id: 'temp', key: 'temp', label: '水温', unit: '℃', decimals: 1, visible: true, sort: 1 },
  { id: 'ph', key: 'ph', label: 'pH', unit: '', decimals: 1, visible: true, sort: 2 },
  { id: 'kh', key: 'kh', label: 'KH', unit: '°dH', decimals: 1, visible: false, sort: 3 },
  { id: 'gh', key: 'gh', label: 'GH', unit: '°dH', decimals: 1, visible: false, sort: 4 },
  { id: 'nh3', key: 'nh3', label: 'アンモニア', unit: 'mg/L', decimals: 2, visible: false, sort: 5 },
  { id: 'no2', key: 'no2', label: '亜硝酸', unit: 'mg/L', decimals: 2, visible: false, sort: 6 },
  { id: 'no3', key: 'no3', label: '硝酸塩', unit: 'mg/L', decimals: 1, visible: false, sort: 7 },
  { id: 'tds', key: 'tds', label: 'TDS', unit: 'ppm', decimals: 0, visible: false, sort: 8 },
];
