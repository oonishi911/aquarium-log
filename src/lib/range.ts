// 注意範囲の判定。水槽ごとの設定がなければ初期値を使う
import { defaultWaterRanges } from '../db/labels';
import type { TankRange } from '../db/types';

export type Range = { min?: number; max?: number };

export function rangeFor(ranges: TankRange[] | undefined, parameterId: string): Range {
  return ranges?.find((r) => r.parameter_id === parameterId) ?? defaultWaterRanges[parameterId] ?? {};
}

export function isOutOfRange(value: number, range: Range) {
  return (range.min !== undefined && value < range.min) || (range.max !== undefined && value > range.max);
}

export function fmtRange(range: Range) {
  if (range.min === undefined && range.max === undefined) return '設定なし';
  return `${range.min ?? ''}〜${range.max ?? ''}`;
}
