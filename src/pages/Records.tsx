import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { TimelineList } from '../components/Timeline';
import { Choice, PageHeader, Select } from '../components/ui';
import { db } from '../db/db';
import { timeline } from '../db/repo';

const kinds = { all: 'すべて', water: '水質', maintenance: '作業', condition: '状態' } as const;
const PAGE = 50;

// 全水槽の記録を新しい順に表示する
export default function Records() {
  const [tankId, setTankId] = useState<string>();
  const [kind, setKind] = useState<keyof typeof kinds>('all');
  const [limit, setLimit] = useState(PAGE);
  const tanks = useLiveQuery(() => db.tanks.toArray()) ?? [];
  const items = useLiveQuery(async () => {
    const all = await timeline(db, tankId);
    return kind === 'all' ? all : all.filter((i) => i.kind === kind);
  }, [tankId, kind]);

  return (
    <section>
      <PageHeader title="記録一覧" />
      {tanks.length > 1 && (
        <div className="mb-2">
          <Select value={tankId} onChange={setTankId} options={tanks.map((t) => [t.id, t.name])} empty="すべての水槽" />
        </div>
      )}
      <div className="mb-3">
        <Choice value={kind} onChange={setKind} options={kinds} />
      </div>
      <TimelineList items={items?.slice(0, limit)} showTank={!tankId && tanks.length > 1} />
      {items && items.length > limit && (
        <button type="button" className="w-full py-3 text-teal-700" onClick={() => setLimit(limit + PAGE)}>
          もっと見る（残り {items.length - limit} 件）
        </button>
      )}
    </section>
  );
}
