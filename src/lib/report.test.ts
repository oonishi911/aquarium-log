import { describe, expect, it } from 'vitest';
import { generateReport, reportKeys } from './report';
import { reportTemplates } from './reportTemplates';

const p = (green_pct: number, yellow_pct: number, brown_pct: number) => ({ green_pct, yellow_pct, brown_pct });
const first = () => 0;

describe('色変化レポートの文章', () => {
  it('前回がなければ初回の文', () => {
    expect(reportKeys(p(60, 20, 10))).toEqual(['first']);
    expect(generateReport(p(60, 20, 10), undefined, { random: first })).toContain('緑 60%');
  });

  it('±2pt 以内は安定', () => {
    expect(reportKeys(p(61, 19, 11), p(60, 20, 10))).toEqual(['stable']);
  });

  it('緑 +8pt は上向き。前回→今回の値が入る', () => {
    expect(reportKeys(p(70, 15, 8), p(62, 18, 9))).toEqual(['greenUp']);
    expect(generateReport(p(70, 15, 8), p(62, 18, 9), { random: first })).toBe('前回より緑の割合が増えています（62%→70%）。調子は上向きのようです。');
  });

  it('黄・茶が 5pt 以上増えたら注意。緑の減少はそちらで説明する', () => {
    expect(reportKeys(p(50, 26, 15), p(62, 20, 9))).toEqual(['yellowUp', 'brownUp']);
    expect(generateReport(p(55, 26, 9), p(62, 20, 9), { random: first })).toBe(
      '黄色っぽい部分が増えています（+6pt）。肥料不足や光量の変化がないか見てみましょう。',
    );
  });

  it('黄・茶が増えずに緑だけ減ったら緑の減少を伝える', () => {
    expect(reportKeys(p(55, 23, 12), p(62, 20, 9))).toEqual(['greenDown']);
  });

  it('回復（黄・茶の減少）も伝える', () => {
    expect(reportKeys(p(70, 10, 8), p(60, 18, 9))).toEqual(['greenUp', 'yellowDown']);
  });

  it('小さな変化', () => {
    expect(reportKeys(p(62.5, 23, 9), p(60, 20, 9))).toEqual(['small']);
  });

  it('撮影条件違いなら末尾に注意文', () => {
    const text = generateReport(p(61, 19, 11), p(60, 20, 10), { conditionMismatch: true, random: first });
    expect(text.endsWith('※撮影条件が前回と違うため、参考値です。')).toBe(true);
  });

  it('言い回しはランダムに選ばれ、差し込み忘れがない', () => {
    for (const list of Object.values(reportTemplates)) expect(list.length).toBeGreaterThan(1);
    const texts = new Set<string>();
    for (let i = 0; i < 3; i++) texts.add(generateReport(p(70, 15, 8), p(62, 18, 9), { random: () => i / 3 }));
    expect(texts.size).toBe(3);
    for (const text of texts) expect(text).not.toMatch(/\{\w+\}/);
  });
});
