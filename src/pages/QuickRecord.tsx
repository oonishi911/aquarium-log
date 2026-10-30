import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, PageHeader } from '../components/ui';
import { db } from '../db/db';

// 下部の「＋記録」から開く。水槽を選んで、記録の種類を選ぶ
export default function QuickRecord() {
  const tanks = useLiveQuery(async () => {
    const list = await db.tanks.where('status').notEqual('removed').toArray();
    return list.sort((a, b) => a.created_at.localeCompare(b.created_at));
  });
  const [picked, setPicked] = useState<string>();
  if (!tanks) return null;
  // 水槽が1つだけなら選ぶ手間を省く
  const tankId = picked ?? (tanks.length === 1 ? tanks[0].id : undefined);

  const actions = [
    ['水質', '水温・pH など', `/tanks/${tankId}/water/new`],
    ['作業', '換水・掃除・給餌 など', `/tanks/${tankId}/maintenance/new`],
    ['生体・水草の様子', '状態・症状・写真', `/tanks/${tankId}?tab=livestock`],
    ['写真', '水槽全体の写真', `/tanks/${tankId}?tab=photos`],
  ];

  return (
    <section>
      <PageHeader title="記録する" />
      {!tanks.length && (
        <Empty>
          先に
          <Link to="/tanks/new" className="text-teal-700">
            水槽を追加
          </Link>
          してください
        </Empty>
      )}
      {tanks.length > 1 && (
        <>
          <p className="mb-2 text-sm font-bold">水槽</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {tanks.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPicked(t.id)}
                className={`rounded-full border px-4 py-2 ${tankId === t.id ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white'}`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </>
      )}
      {tankId && (
        <div className="grid grid-cols-2 gap-3">
          {actions.map(([label, sub, to]) => (
            <Link key={label} to={to} className="rounded-xl border border-teal-200 bg-white p-4 text-center shadow-sm active:bg-teal-50">
              <div className="text-lg font-bold text-teal-800">{label}</div>
              <div className="text-xs text-slate-500">{sub}</div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
