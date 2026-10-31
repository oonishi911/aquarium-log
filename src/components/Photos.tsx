import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../db/db';
import { photosOf } from '../db/repo';
import type { Photo, PhotoOwner } from '../db/types';
import { fmtDateTime } from '../lib/date';

function useObjectUrl(blob?: Blob) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

function Thumb({ blob, onClick, size = 'h-20 w-20' }: { blob: Blob; onClick?: () => void; size?: string }) {
  const url = useObjectUrl(blob);
  return (
    <button type="button" onClick={onClick} className={`${size} shrink-0 overflow-hidden rounded-lg bg-slate-200`}>
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
    </button>
  );
}

// 保存前に選んだ写真。フォームの保存時にまとめて縮小・保存する
export function PhotoPicker({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {files.map((f, i) => (
          <div key={i} className="relative">
            <Thumb blob={f} />
            <button
              type="button"
              onClick={() => onChange(files.filter((_, j) => j !== i))}
              className="absolute -right-1 -top-1 h-6 w-6 rounded-full bg-slate-700 text-xs text-white"
              aria-label="取り消す"
            >
              ×
            </button>
          </div>
        ))}
        <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-3xl text-slate-400">
          ＋
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              onChange([...files, ...Array.from(e.target.files ?? [])]);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      <p className="mt-1 text-xs text-slate-500">写真は長辺1600pxに縮小して、この端末の中だけに保存します</p>
    </div>
  );
}

function PhotoViewer({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const url = useObjectUrl(photo.blob);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" onClick={onClose}>
      <div className="flex items-center justify-between p-3 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="text-sm">{fmtDateTime(photo.taken_at)}</span>
        <div className="flex gap-3">
          <button
            type="button"
            className="rounded border border-red-300 px-3 py-1 text-sm text-red-200"
            onClick={async () => {
              if (!confirm('この写真を削除しますか？')) return;
              await db.photos.delete(photo.id);
              onClose();
            }}
          >
            削除
          </button>
          <button type="button" className="px-3 py-1 text-2xl" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center p-2">{url && <img src={url} alt="" className="max-h-full max-w-full object-contain" />}</div>
    </div>
  );
}

export function PhotoGrid({ photos, size }: { photos: Photo[]; size?: string }) {
  const [open, setOpen] = useState<Photo>();
  if (!photos.length) return null;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <Thumb key={p.id} blob={p.blob} size={size} onClick={() => setOpen(p)} />
        ))}
      </div>
      {open && <PhotoViewer photo={open} onClose={() => setOpen(undefined)} />}
    </>
  );
}

// 保存済みの写真を持ち主ごとに表示する
export function OwnerPhotos({ owner, id, size }: { owner: PhotoOwner; id: string; size?: string }) {
  const photos = useLiveQuery(() => photosOf(db, owner, id), [owner, id]) ?? [];
  return <PhotoGrid photos={photos} size={size} />;
}
