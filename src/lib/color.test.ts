import { describe, expect, it } from 'vitest';
import { classifyHsv, classifyPixels, defaultThresholds, rgbToHsv } from './color';

const t = defaultThresholds;
const px = (...colors: [number, number, number][]) => new Uint8ClampedArray(colors.flatMap(([r, g, b]) => [r, g, b, 255]));

describe('HSV 変換', () => {
  it('代表的な色の色相', () => {
    expect(rgbToHsv(255, 0, 0).h).toBe(0);
    expect(rgbToHsv(0, 255, 0).h).toBe(120);
    expect(rgbToHsv(0, 0, 255).h).toBe(240);
    expect(rgbToHsv(255, 255, 0).h).toBe(60);
    expect(rgbToHsv(128, 128, 128)).toEqual({ h: 0, s: 0, v: 128 / 255 });
  });
});

describe('色の分類', () => {
  it('緑・黄・茶・その他・除外に分ける', () => {
    const c = (r: number, g: number, b: number) => {
      const { h, s, v } = rgbToHsv(r, g, b);
      return classifyHsv(h, s, v, t);
    };
    expect(c(40, 160, 60)).toBe('green');
    expect(c(220, 200, 40)).toBe('yellow');
    expect(c(110, 70, 30)).toBe('brown');
    expect(c(230, 140, 40)).toBe('other'); // 明るいオレンジは茶に入れない
    expect(c(200, 40, 60)).toBe('other'); // 赤
    expect(c(10, 10, 10)).toBe('excluded'); // 影
    expect(c(200, 200, 200)).toBe('excluded'); // 砂・ガラス
    expect(c(255, 255, 250)).toBe('excluded'); // 反射
  });

  it('割合は除外した画素を除いて計算する', () => {
    const data = px([40, 160, 60], [40, 160, 60], [220, 200, 40], [110, 70, 30], [10, 10, 10]);
    const r = classifyPixels(data, t);
    expect(r).toEqual({ green_pct: 50, yellow_pct: 25, brown_pct: 25, other_pct: 0, excluded_pct: 20, pixels: 5 });
  });

  it('マスク外の画素は数えない', () => {
    const data = px([40, 160, 60], [220, 200, 40]);
    const mask = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 0]);
    expect(classifyPixels(data, t, mask).green_pct).toBe(100);
    expect(classifyPixels(data, t, mask).pixels).toBe(1);
  });

  it('しきい値を変えると分類が変わる', () => {
    const data = px([220, 200, 40]); // 色相 約53°
    expect(classifyPixels(data, { ...t, greenMin: 50 }).green_pct).toBe(100);
  });
});
