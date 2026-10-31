// 写真を長辺 1600px 程度に縮小して端末内（IndexedDB）に保存する。サーバーには送らない
import type { AquariumDB } from '../db/db';
import { addPhoto } from '../db/repo';
import type { PhotoOwner } from '../db/types';

export const MAX_SIDE = 1600;

function loadImage(file: Blob): Promise<HTMLImageElement> {
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
  for (const file of files) {
    const { blob, width, height } = await resizeImage(file);
    // 撮影日時はファイルの更新日時で代用する（多くのスマホでは撮影時刻と同じ）
    const taken_at = new Date(file.lastModified || Date.now()).toISOString();
    await addPhoto(db, { owner_type, owner_id, tank_id, taken_at, blob, width, height });
  }
}
