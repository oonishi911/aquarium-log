import { DB_NAME, SCHEMA_VERSION } from '../db/db';

export default function Settings() {
  return (
    <section>
      <h1 className="mb-2 text-xl font-bold">設定</h1>
      <p className="text-sm text-slate-600">データはこの端末内にのみ保存されます。定期的にバックアップを書き出してください。</p>
      <p className="mt-4 text-xs text-slate-500">
        DB: {DB_NAME} / スキーマ v{SCHEMA_VERSION}
      </p>
    </section>
  );
}
