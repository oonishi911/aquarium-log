// 色の割合の変化量と方向から、文例（reportTemplates）を選んで文章にする
import { reportTemplates, type ReportTemplateKey } from './reportTemplates';

export type ColorPcts = { green_pct: number; yellow_pct: number; brown_pct: number };

// 変化の目安（ポイント差）
export const STABLE_PT = 2;
export const GREEN_PT = 3;
export const WARN_PT = 5;

const round1 = (n: number) => Math.round(n * 10) / 10;

function fill(text: string, vars: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

// 使う場面のキーを選ぶ（文の並び順もこの順）
export function reportKeys(current: ColorPcts, previous?: ColorPcts): ReportTemplateKey[] {
  if (!previous) return ['first'];
  const dg = current.green_pct - previous.green_pct;
  const dy = current.yellow_pct - previous.yellow_pct;
  const db = current.brown_pct - previous.brown_pct;
  if (Math.abs(dg) <= STABLE_PT && Math.abs(dy) <= STABLE_PT && Math.abs(db) <= STABLE_PT) return ['stable'];

  const keys: ReportTemplateKey[] = [];
  if (dg >= GREEN_PT) keys.push('greenUp');
  if (dy >= WARN_PT) keys.push('yellowUp');
  if (db >= WARN_PT) keys.push('brownUp');
  // 緑の減少は、黄・茶の増加で説明できないときだけ伝える
  if (dg <= -GREEN_PT && dy < WARN_PT && db < WARN_PT) keys.push('greenDown');
  if (dy <= -WARN_PT) keys.push('yellowDown');
  if (db <= -WARN_PT) keys.push('brownDown');
  return keys.length ? keys : ['small'];
}

const field: Partial<Record<ReportTemplateKey, keyof ColorPcts>> = {
  greenUp: 'green_pct',
  greenDown: 'green_pct',
  yellowUp: 'yellow_pct',
  yellowDown: 'yellow_pct',
  brownUp: 'brown_pct',
  brownDown: 'brown_pct',
};

// random は 0 以上 1 未満を返す関数（テストで固定できるように差し替え可能）
export function generateReport(current: ColorPcts, previous: ColorPcts | undefined, opts: { conditionMismatch?: boolean; random?: () => number } = {}) {
  const random = opts.random ?? Math.random;
  const pick = (list: string[]) => list[Math.floor(random() * list.length)];
  const base = { green: round1(current.green_pct), yellow: round1(current.yellow_pct), brown: round1(current.brown_pct) };

  const sentences = reportKeys(current, previous).map((key) => {
    const f = field[key];
    const vars: Record<string, string | number> = { ...base };
    if (f && previous) {
      vars.from = round1(previous[f]);
      vars.to = round1(current[f]);
      vars.diff = round1(Math.abs(current[f] - previous[f]));
    }
    return fill(pick(reportTemplates[key]), vars);
  });
  if (previous && opts.conditionMismatch) sentences.push(pick(reportTemplates.conditionNote));
  return sentences.join('');
}
