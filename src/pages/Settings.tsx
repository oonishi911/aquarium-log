import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { btnDanger, btnPrimary, btnSecondary, Card, Field, NumberInput, PageHeader, Select, TextInput } from '../components/ui';
import { backupFileName, exportBackup, importBackup } from '../db/backup';
import { DB_NAME, SCHEMA_VERSION, db } from '../db/db';
import { maintenanceTypeLabels } from '../db/labels';
import { getColorThresholds, saveColorThresholds, saveMaintenanceTemplate } from '../db/repo';
import type { ColorThresholds, MaintenanceTemplate } from '../db/types';
import { defaultThresholds } from '../lib/color';
import { fmtDateTime } from '../lib/date';

// 最終バックアップ日時は表示用の目安なので、端末の localStorage に置く
const BACKUP_KEY = 'aquarium-log:last-backup-at';
export function lastBackupAt() {
  try {
    return localStorage.getItem(BACKUP_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export default function Settings() {
  return (
    <section>
      <PageHeader title="設定" />
      <WaterParams />
      <Templates />
      <ColorSettings />
      <BackupSection />
      <p className="mt-6 text-xs text-slate-500">
        DB: {DB_NAME} / スキーマ v{SCHEMA_VERSION}
      </p>
    </section>
  );
}

function WaterParams() {
  const params = useLiveQuery(() => db.waterParameters.orderBy('sort').toArray()) ?? [];
  return (
    <>
      <h2 className="mb-2 mt-2 font-bold">水質の入力項目</h2>
      <Card>
        <p className="mb-2 text-xs text-slate-500">ONにした項目だけ、水質の記録画面に表示します</p>
        {params.map((p) => (
          <label key={p.id} className="flex items-center justify-between border-b py-2 last:border-b-0">
            <span>
              {p.label}
              {p.unit && <span className="ml-1 text-xs text-slate-500">{p.unit}</span>}
            </span>
            <input type="checkbox" className="h-5 w-5 accent-teal-700" checked={p.visible} onChange={(e) => db.waterParameters.update(p.id, { visible: e.target.checked })} />
          </label>
        ))}
      </Card>
    </>
  );
}

function Templates() {
  const templates = useLiveQuery(() => db.maintenanceTemplates.orderBy('name').toArray()) ?? [];
  const [editing, setEditing] = useState<Partial<MaintenanceTemplate>>();

  async function save() {
    if (!editing?.name?.trim() || !editing.type) return alert('名前と作業の種類を入れてください');
    const { created_at: _c, updated_at: _u, ...rest } = editing;
    await saveMaintenanceTemplate(db, { ...rest, name: editing.name.trim(), type: editing.type });
    setEditing(undefined);
  }

  return (
    <>
      <h2 className="mb-2 mt-5 font-bold">作業テンプレート</h2>
      <Card>
        <p className="mb-2 text-xs text-slate-500">作業の記録画面で、1タップで入力できます</p>
        {templates.map((t) => (
          <div key={t.id} className="flex items-center gap-2 border-b py-2 last:border-b-0">
            <span className="flex-1">
              {t.name}
              <span className="ml-1 text-xs text-slate-500">
                {maintenanceTypeLabels[t.type]}
                {t.amount !== undefined && ` ${t.amount}${t.unit ?? ''}`}
              </span>
            </span>
            <button type="button" className="text-sm text-teal-700" onClick={() => setEditing(t)}>
              編集
            </button>
            <button
              type="button"
              className="text-sm text-red-600"
              onClick={() => {
                if (confirm(`テンプレート「${t.name}」を削除しますか？`)) db.maintenanceTemplates.delete(t.id);
              }}
            >
              削除
            </button>
          </div>
        ))}
        {editing ? (
          <div className="mt-3 rounded-lg bg-teal-50 p-3">
            <Field label="名前">
              <TextInput value={editing.name} onChange={(name) => setEditing({ ...editing, name })} placeholder="1/3換水＋カルキ抜き" />
            </Field>
            <Field label="作業の種類">
              <Select value={editing.type} onChange={(type) => setEditing({ ...editing, type })} options={maintenanceTypeLabels} empty="選んでください" />
            </Field>
            <Field label="量">
              <div className="grid grid-cols-[1fr_6rem] gap-2">
                <NumberInput value={editing.amount} onChange={(amount) => setEditing({ ...editing, amount })} />
                <TextInput value={editing.unit} onChange={(unit) => setEditing({ ...editing, unit })} placeholder="% / L" />
              </div>
            </Field>
            <Field label="メモ">
              <TextInput value={editing.memo} onChange={(memo) => setEditing({ ...editing, memo })} />
            </Field>
            <div className="flex gap-2">
              <button type="button" className={`${btnPrimary} flex-1 py-2`} onClick={save}>
                保存
              </button>
              <button type="button" className={btnSecondary} onClick={() => setEditing(undefined)}>
                やめる
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={`${btnSecondary} mt-2 w-full`} onClick={() => setEditing({})}>
            ＋ テンプレートを追加
          </button>
        )}
      </Card>
    </>
  );
}

const thresholdFields: [keyof ColorThresholds, string, string][] = [
  ['greenMin', '緑 色相の下限', '°'],
  ['greenMax', '緑 色相の上限', '°'],
  ['yellowMin', '黄 色相の下限（上限は緑の下限）', '°'],
  ['brownMin', '茶 色相の下限（上限は黄の下限）', '°'],
  ['brownMaxV', '茶とみなす明るさの上限', '0〜1'],
  ['minS', '除外: 彩度がこれ未満', '0〜1'],
  ['minV', '除外: 明るさがこれ未満', '0〜1'],
  ['maxV', '除外: 明るさがこれを超える反射', '0〜1'],
];

function ColorSettings() {
  const [t, setT] = useState<ColorThresholds>();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    getColorThresholds(db).then(setT);
  }, []);
  if (!t) return null;

  async function save(next: ColorThresholds) {
    if (next.yellowMin >= next.greenMin || next.brownMin >= next.yellowMin || next.greenMin >= next.greenMax) {
      return alert('色相は 茶の下限 < 黄の下限 < 緑の下限 < 緑の上限 の順になるようにしてください');
    }
    await saveColorThresholds(db, next);
    setT(next);
    setSaved(true);
  }

  return (
    <>
      <h2 className="mb-2 mt-5 font-bold">水草の色分類のしきい値</h2>
      <Card>
        <p className="mb-2 text-xs text-slate-500">
          色変化レポートで、画素を緑・黄・茶に分ける基準です。色相は 0〜360°（赤 0°・黄 60°・緑 120°）。保存済みのレポートの数値は変わりません。
        </p>
        {thresholdFields.map(([key, label, unit]) => (
          <div key={key} className="grid grid-cols-[1fr_6rem] items-center gap-2 border-b py-1.5 last:border-b-0">
            <span className="text-sm">
              {label}
              <span className="ml-1 text-xs text-slate-500">{unit}</span>
            </span>
            <NumberInput
              value={t[key]}
              onChange={(v) => {
                setSaved(false);
                setT({ ...t, [key]: v ?? defaultThresholds[key] });
              }}
            />
          </div>
        ))}
        <div className="mt-2 flex gap-2">
          <button type="button" className={`${btnPrimary} flex-1 py-2`} onClick={() => save(t)}>
            保存
          </button>
          <button type="button" className={btnSecondary} onClick={() => save(defaultThresholds)}>
            初期値に戻す
          </button>
        </div>
        {saved && <p className="mt-2 text-xs text-teal-700">✓ 保存しました</p>}
      </Card>
    </>
  );
}

function BackupSection() {
  const [last, setLast] = useState(lastBackupAt());
  const [busy, setBusy] = useState(false);
  const [persisted, setPersisted] = useState<boolean>();

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  async function doExport() {
    setBusy(true);
    try {
      const data = await exportBackup(db);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName();
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      const now = new Date().toISOString();
      try {
        localStorage.setItem(BACKUP_KEY, now);
      } catch {
        // 保存できなくても書き出し自体はできている
      }
      setLast(now);
    } catch (err) {
      alert(`書き出せませんでした: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function doImport(file: File) {
    if (!confirm('いまこの端末にある記録は、すべてバックアップの内容に置き換わります。よろしいですか？')) return;
    setBusy(true);
    try {
      await importBackup(db, JSON.parse(await file.text()));
      alert('読み込みました');
    } catch (err) {
      alert(`読み込めませんでした: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="mb-2 mt-5 font-bold">バックアップ</h2>
      <Card>
        <p className="mb-3 text-sm text-slate-600">
          記録と写真はこの端末の中にだけ保存されています。ブラウザのデータ削除や機種変更で消えるので、定期的に書き出して、パソコンやクラウドなど別の場所に保管してください。
        </p>
        <p className="mb-2 text-xs text-slate-500">最後の書き出し: {last ? fmtDateTime(last) : 'まだありません'}</p>
        <button type="button" disabled={busy} className={`${btnPrimary} w-full`} onClick={doExport}>
          {busy ? '処理中…' : 'バックアップを書き出す（写真込み JSON）'}
        </button>
        <label className={`${btnDanger} mt-2 block cursor-pointer text-center`}>
          バックアップから読み込む（置き換え）
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) doImport(file);
            }}
          />
        </label>
        {persisted === false && (
          <button
            type="button"
            className={`${btnSecondary} mt-2 w-full text-sm`}
            onClick={async () => setPersisted(await navigator.storage.persist())}
          >
            データを消されにくくする（ブラウザに保存の継続を依頼）
          </button>
        )}
        {persisted && <p className="mt-2 text-xs text-teal-700">✓ ブラウザに保存の継続を依頼済みです</p>}
      </Card>
    </>
  );
}
