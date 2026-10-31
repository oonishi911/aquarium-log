import { describe, expect, it } from 'vitest';
import { daysSince, fmtDate, fromLocalInput, toLocalInput } from './date';

describe('date', () => {
  it('入力欄の値と ISO を相互に変換できる', () => {
    expect(toLocalInput(fromLocalInput('2026-10-30T21:05'))).toBe('2026-10-30T21:05');
  });
  it('経過日数を数える', () => {
    expect(daysSince('2026-10-01', new Date(2026, 9, 30, 23, 0))).toBe(29);
    expect(daysSince('2026-10-30', new Date(2026, 9, 30, 8, 0))).toBe(0);
  });
  it('日付を表示用にする', () => {
    expect(fmtDate('2026-01-05')).toBe('2026/1/5');
  });
});
