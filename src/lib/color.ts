// 水草写真の色分類。画素を HSV に変換して 緑 / 黄 / 茶 / その他 に分ける（要件 5.2）
// 画像はサーバーに送らず、ブラウザ内の Canvas で読み取った画素だけで計算する
import type { ColorThresholds } from '../db/types';

export const defaultThresholds: ColorThresholds = {
  greenMin: 70,
  greenMax: 170,
  yellowMin: 40,
  brownMin: 10,
  brownMaxV: 0.6,
  minS: 0.15,
  minV: 0.12,
  maxV: 0.97,
};

// r, g, b は 0〜255。h は 0〜360°、s・v は 0〜1
export function rgbToHsv(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export type ColorClass = 'green' | 'yellow' | 'brown' | 'other' | 'excluded';

export function classifyHsv(h: number, s: number, v: number, t: ColorThresholds): ColorClass {
  // 影・砂・ガラスの反射など、色を判断できない画素は集計から外す
  if (v < t.minV || s < t.minS || (v > t.maxV && s < 0.3)) return 'excluded';
  if (h >= t.greenMin && h <= t.greenMax) return 'green';
  if (h >= t.yellowMin && h < t.greenMin) return 'yellow';
  if (h >= t.brownMin && h < t.yellowMin && v <= t.brownMaxV) return 'brown';
  return 'other';
}

export type ColorResult = {
  green_pct: number;
  yellow_pct: number;
  brown_pct: number;
  other_pct: number;
  excluded_pct: number;
  pixels: number; // 範囲内の画素数
};

// data は RGBA の並び（ImageData.data）。mask があれば、その画素の値が 0 より大きいものだけ数える
// 緑・黄・茶・その他は「集計対象の画素」に対する割合、excluded は範囲全体に対する割合
export function classifyPixels(data: Uint8ClampedArray, t: ColorThresholds, mask?: Uint8ClampedArray): ColorResult {
  const counts = { green: 0, yellow: 0, brown: 0, other: 0, excluded: 0 };
  let pixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (mask && mask[i + 3] === 0) continue;
    pixels++;
    const { h, s, v } = rgbToHsv(data[i], data[i + 1], data[i + 2]);
    counts[classifyHsv(h, s, v, t)]++;
  }
  const valid = pixels - counts.excluded;
  const pct = (n: number, total: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);
  return {
    green_pct: pct(counts.green, valid),
    yellow_pct: pct(counts.yellow, valid),
    brown_pct: pct(counts.brown, valid),
    other_pct: pct(counts.other, valid),
    excluded_pct: pct(counts.excluded, pixels),
    pixels,
  };
}
