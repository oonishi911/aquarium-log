import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ColorBars } from '../components/ColorBars';
import { btnPrimary, Card, Choice, Field, PageHeader, Select, TextInput } from '../components/ui';
import { db } from '../db/db';
import { colorAnalysesOf, getColorThresholds, photosOf, previousAnalysis, saveColorAnalysis } from '../db/repo';
import type { ColorRegion, Photo } from '../db/types';
import type { ColorResult } from '../lib/color';
import { fmtDateTime } from '../lib/date';
import { analyzeRegion, savePhotos } from '../lib/image';
import { generateReport } from '../lib/report';
import { PhotoGuideChecklist } from './PhotoGuide';

// 水草の色変化レポート（要件 5章）: 写真を選ぶ → 範囲を囲む → 色の割合 → 前回と比較 → 文章
// 画像はサーバーに送らず、すべて端末内で計算する
export default function ColorReport() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [photoId, setPhotoId] = useState<string>();
  const [result, setResult] = useState<ColorResult & { region: ColorRegion }>();
  const [compareId, setCompareId] = useState<string>();
  const [conditionOk, setConditionOk] = useState(true);
  const [conditionMemo, setConditionMemo] = useState('');
  const [busy, setBusy] = useState(false);

  const data = useLiveQuery(async () => {
    const plant = await db.plants.get(id);
    if (!plant) return null;
    const species = await db.species.get(plant.species_id);
    // 水草本体の写真と、その水草の状態記録に付けた写真から選べる
    const condIds = (await db.conditionLogs.where('[target_type+target_id]').equals(['plant', id]).toArray()).map((l) => l.id);
    const condPhotos = condIds.length ? await db.photos.where('[owner_type+owner_id]').anyOf(condIds.map((c) => ['condition', c])).toArray() : [];
    const photos = [...(await photosOf(db, 'plant', id)), ...condPhotos].sort((a, b) => b.taken_at.localeCompare(a.taken_at));
    const analyses = await colorAnalysesOf(db, id);
    return { plant, name: species?.name ?? '水草', photos, analyses };
  }, [id]);

  const photo = data?.photos.find((p) => p.id === photoId);

  // 写真を選んだら、比較相手の初期値（その写真より前の最新の分析）と撮影条件を入れる
  useEffect(() => {
    if (!photo) return;
    setResult(undefined);
    setConditionOk(photo.condition_ok ?? true);
    setConditionMemo(photo.condition_memo ?? '');
    previousAnalysis(db, id, photo.taken_at).then((a) => setCompareId(a?.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.id]);

  const compare = data?.analyses.find((a) => a.id === compareId);
  const conditionMismatch = !conditionOk || (compare ? !compare.condition_ok : false);
  const text = useMemo(() => (result ? generateReport(result, compare, { conditionMismatch }) : ''), [result, compare, conditionMismatch]);

  if (data === undefined) return null;
  if (data === null) return <p>水草が見つかりません</p>;

  async function addPhoto(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    try {
      const [saved] = await savePhotos(db, files, 'plant', id, data!.plant.tank_id);
      setPhotoId(saved.id);
    } catch (err) {
      alert(`写真を保存できませんでした: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function analyze(region: ColorRegion) {
    if (!photo) return;
    setBusy(true);
    try {
      const thresholds = await getColorThresholds(db);
      const r = await analyzeRegion(photo.blob, region, thresholds);
      if (r.pixels === 0 || r.excluded_pct >= 100) return alert('選んだ範囲に色を判断できる部分がありません。範囲を広げてみてください');
      setResult({ ...r, region });
    } catch (err) {
      alert(`分析できませんでした: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!photo || !result) return;
    setBusy(true);
    try {
      const { region, pixels: _p, ...pcts } = result;
      const settings_snapshot = await getColorThresholds(db);
      await saveColorAnalysis(db, {
        plant_id: id,
        tank_id: data!.plant.tank_id,
        photo_id: photo.id,
        taken_at: photo.taken_at,
        region,
        ...pcts,
        condition_ok: conditionOk,
        condition_memo: conditionMemo.trim() || undefined,
        compared_with_id: compare?.id,
        generated_text: text,
        settings_snapshot,
      });
      await db.photos.update(photo.id, { condition_ok: conditionOk, condition_memo: conditionMemo.trim() || undefined });
      navigate(`/plants/${id}`, { replace: true });
    } catch (err) {
      alert(`保存できませんでした: ${(err as Error).message}`);
      setBusy(false);
    }
  }

  return (
    <section>
      <PageHeader title={`色変化レポート：${data.name}`} back />

      {!photo && <PickPhoto photos={data.photos} analyzed={new Set(data.analyses.map((a) => a.photo_id))} busy={busy} onPick={setPhotoId} onAdd={addPhoto} />}

      {photo && (
        <>
          <p className="mb-2 text-sm text-slate-600">
            {fmtDateTime(photo.taken_at)} の写真
            <button type="button" className="ml-2 text-teal-700" onClick={() => setPhotoId(undefined)}>
              写真を選び直す
            </button>
          </p>
          <RegionSelector key={photo.id} photo={photo} busy={busy} onAnalyze={analyze} />
        </>
      )}

      {photo && result && (
        <div className="mt-4">
          <h2 className="mb-2 font-bold">結果</h2>
          <Card>
            <ColorBars current={result} previous={compare} />
            <p className="mt-2 text-xs text-slate-500">
              緑・黄・茶・その他は、影や反射など色を判断できない部分（範囲の {result.excluded_pct}%）を除いた割合です
            </p>
          </Card>

          <Field label="比較する記録">
            <Select
              value={compareId}
              onChange={setCompareId}
              empty="比較しない（初回として扱う）"
              options={data.analyses
                .filter((a) => a.photo_id !== photo.id)
                .slice()
                .reverse()
                .map((a) => [a.id, `${fmtDateTime(a.taken_at)}（緑${a.green_pct}% 黄${a.yellow_pct}% 茶${a.brown_pct}%）${a.condition_ok ? '' : ' 条件違い'}`])}
            />
          </Field>

          <label className="mb-2 flex items-center gap-2">
            <input type="checkbox" className="h-5 w-5 accent-teal-700" checked={conditionOk} onChange={(e) => setConditionOk(e.target.checked)} />
            <span>撮影ルールを守れた</span>
            <Link to="/guide" className="text-sm text-teal-700">
              撮影ガイド ›
            </Link>
          </label>
          {!conditionOk && (
            <Field label="いつもと違った点">
              <TextInput value={conditionMemo} onChange={setConditionMemo} placeholder="部屋の照明がついていた など" />
            </Field>
          )}

          <Card>
            <p className="mb-1 text-xs font-bold text-slate-500">レポート</p>
            <p>{text}</p>
          </Card>

          <div className="sticky bottom-14 mt-4 bg-teal-50 py-2">
            <button type="button" disabled={busy} className={`${btnPrimary} w-full`} onClick={save}>
              {busy ? '保存中…' : 'この結果を保存'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

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

function PhotoThumb({ photo, onClick, analyzed }: { photo: Photo; onClick: () => void; analyzed: boolean }) {
  const url = useObjectUrl(photo.blob);
  return (
    <button type="button" onClick={onClick} className="relative h-24 w-24 overflow-hidden rounded-lg bg-slate-200">
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      <span className="absolute inset-x-0 bottom-0 bg-black/50 px-1 text-[10px] text-white">
        {fmtDateTime(photo.taken_at)}
        {analyzed && ' ✓分析済'}
      </span>
    </button>
  );
}

function PickPhoto({ photos, analyzed, busy, onPick, onAdd }: { photos: Photo[]; analyzed: Set<string>; busy: boolean; onPick: (id: string) => void; onAdd: (f: File[]) => void }) {
  const [showGuide, setShowGuide] = useState(false);
  return (
    <div>
      <Card>
        <button type="button" className="flex w-full items-center justify-between font-bold text-teal-800" onClick={() => setShowGuide(!showGuide)}>
          <span>📷 撮影前のチェック</span>
          <span>{showGuide ? '▲' : '▼'}</span>
        </button>
        {showGuide && <PhotoGuideChecklist />}
      </Card>
      <label className={`${btnPrimary} mb-3 block cursor-pointer text-center`}>
        {busy ? '保存中…' : '＋ 写真を撮る・選ぶ'}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            onAdd(files);
          }}
        />
      </label>
      <h2 className="mb-2 font-bold">保存済みの写真から選ぶ</h2>
      {photos.length ? (
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <PhotoThumb key={p.id} photo={p} analyzed={analyzed.has(p.id)} onClick={() => onPick(p.id)} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">この水草の写真はまだありません</p>
      )}
    </div>
  );
}

const shapes = { rect: '四角', lasso: '自由に囲む' } as const;
const clamp = (n: number) => Math.min(1, Math.max(0, n));

// 写真の上を指でなぞって範囲を選ぶ。座標は写真の幅・高さに対する割合で持つ
function RegionSelector({ photo, busy, onAnalyze }: { photo: Photo; busy: boolean; onAnalyze: (r: ColorRegion) => void }) {
  const url = useObjectUrl(photo.blob);
  const box = useRef<HTMLDivElement>(null);
  const [shape, setShape] = useState<keyof typeof shapes>('rect');
  const [region, setRegion] = useState<ColorRegion>();
  const drag = useRef<{ start: [number, number]; points: [number, number][] }>();

  const pos = (e: PointerEvent): [number, number] => {
    const r = box.current!.getBoundingClientRect();
    return [clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height)];
  };
  const rectOf = ([x1, y1]: [number, number], [x2, y2]: [number, number]): ColorRegion => ({
    shape: 'rect',
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  });

  function down(e: PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pos(e);
    drag.current = { start: p, points: [p] };
    setRegion(shape === 'rect' ? rectOf(p, p) : { shape: 'lasso', points: [p] });
  }
  function move(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const p = pos(e);
    if (shape === 'rect') return setRegion(rectOf(d.start, p));
    const last = d.points[d.points.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.005) return;
    d.points = [...d.points, p];
    setRegion({ shape: 'lasso', points: d.points });
  }
  function up() {
    drag.current = undefined;
  }

  const valid = region && (region.shape === 'rect' ? region.w > 0.02 && region.h > 0.02 : region.points.length >= 3);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Choice
          value={shape}
          onChange={(s) => {
            setShape(s);
            setRegion(undefined);
          }}
          options={shapes}
        />
        {region && (
          <button type="button" className="ml-auto text-sm text-teal-700" onClick={() => setRegion(undefined)}>
            やり直す
          </button>
        )}
      </div>
      <p className="mb-2 text-xs text-slate-500">
        {shape === 'rect' ? '水草の部分を指でななめになぞって、四角く囲んでください' : '水草の形にそって指でぐるっと囲んでください'}
        。底床やガラスの反射はなるべく入れないのがコツです。
      </p>
      <div
        ref={box}
        className="relative select-none overflow-hidden rounded-lg bg-slate-200"
        style={{ touchAction: 'none', aspectRatio: `${photo.width} / ${photo.height}` }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {url && <img src={url} alt="" draggable={false} className="pointer-events-none h-full w-full" />}
        {region && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
            {region.shape === 'rect' ? (
              <rect x={region.x} y={region.y} width={region.w} height={region.h} fill="rgba(255,255,255,0.15)" stroke="#fff" strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
            ) : (
              <polygon
                points={region.points.map((p) => p.join(',')).join(' ')}
                fill="rgba(255,255,255,0.15)"
                stroke="#fff"
                strokeWidth={2}
                strokeDasharray="6 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        )}
      </div>
      <button type="button" disabled={!valid || busy} className={`${btnPrimary} mt-3 w-full`} onClick={() => region && onAnalyze(region)}>
        {busy ? '計算中…' : 'この範囲の色を調べる'}
      </button>
    </div>
  );
}
