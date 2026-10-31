import { describe, expect, it } from 'vitest';
import { isOutOfRange, rangeFor } from './range';

describe('注意範囲', () => {
  it('水槽の設定がなければ初期値を使う', () => {
    expect(rangeFor([], 'temp')).toEqual({ min: 24, max: 28 });
    expect(rangeFor([{ tank_id: 't', parameter_id: 'temp', min: 22, max: 26 }], 'temp')).toEqual({ tank_id: 't', parameter_id: 'temp', min: 22, max: 26 });
    expect(rangeFor([], 'unknown')).toEqual({});
  });

  it('範囲外の判定（片側だけの指定も可）', () => {
    expect(isOutOfRange(23.9, { min: 24, max: 28 })).toBe(true);
    expect(isOutOfRange(28, { min: 24, max: 28 })).toBe(false);
    expect(isOutOfRange(0.3, { max: 0.2 })).toBe(true);
    expect(isOutOfRange(100, {})).toBe(false);
  });
});
