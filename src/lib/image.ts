// 写真を長辺 1600px 程度に縮小して端末内（IndexedDB）に保存する。サーバーには送らない
import type { AquariumDB } from '../db/db';
import { addPhoto } from '../db/repo';
import type { ColorRegion, ColorThresholds, PhotoOwner } from '../db/types';
import { classifyPixels } from './color';

export const MAX_SIDE = 1600;

export function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('画像を読み込めませんでした'));
    };
    img.src = url;
  });
}

export async function resizeImage(file: Blob, maxSide = MAX_SIDE) {
  const img = await loadImage(file);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('画像を変換できませんでした'))), 'image/jpeg', 0.85),
  );
  return { blob, width, height };
}

export async function savePhotos(db: AquariumDB, files: File[], owner_type: PhotoOwner, owner_id: string, tank_id: string) {
  const saved = [];
  for (const file of files) {
    const { blob, width, height } = await resizeImage(file);
    // 撮影日時はファイルの更新日時で代用する（多くのスマホでは撮影時刻と同じ）
    const taken_at = new Date(file.lastModified || Date.now()).toISOString();
    saved.push(await addPhoto(db, { owner_type, owner_id, tank_id, taken_at, blob, width, height }));
  }
  return saved;
}

// 色分析は計算を速くするため、長辺この大きさまで縮小した画素で行う（割合なので結果はほぼ変わらない）
const ANALYSIS_SIDE = 800;

// 写真の選んだ範囲を色分類する。すべて端末内の Canvas で計算する
export async function analyzeRegion(blob: Blob, region: ColorRegion, thresholds: ColorThresholds) {
  const img = await loadImage(blob);
  const scale = Math.min(1, ANALYSIS_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);

  if (region.shape === 'rect') {
    const x = Math.floor(region.x * w);
    const y = Math.floor(region.y * h);
    const rw = Math.max(1, Math.round(region.w * w));
    const rh = Math.max(1, Math.round(region.h * h));
    return classifyPixels(ctx.getImageData(x, y, rw, rh).data, thresholds);
  }
  // 自由形: 囲んだ形を別の Canvas に塗り、塗られた画素だけを数える
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = w;
  maskCanvas.height = h;
  const m = maskCanvas.getContext('2d', { willReadFrequently: true })!;
  m.beginPath();
  region.points.forEach(([px, py], i) => (i ? m.lineTo(px * w, py * h) : m.moveTo(px * w, py * h)));
  m.closePath();
  m.fill();
  return classifyPixels(ctx.getImageData(0, 0, w, h).data, thresholds, m.getImageData(0, 0, w, h).data);
}
