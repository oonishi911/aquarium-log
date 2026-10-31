import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, btnPrimary, Card, Empty } from '../components/ui';
import { db } from '../db/db';
import { attentionLivestock, attentionPlant, tankStatusLabels } from '../db/labels';
import { tankRanges, tankSummary } from '../db/repo';
import { daysSince } from '../lib/date';
import { isOutOfRange, rangeFor } from '../lib/range';
import { lastBackupAt } from './Settings';

export default function Home() {
  const [showRemoved, setShowRemoved] = useState(false);
  const cards = useLiveQuery(async () => {
    const tanks = await db.tanks.toArray();
    tanks.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return Promise.all(
      tanks.map(async (tank) => {
        const [summary, ranges, sick, poorPlants] = await Promise.all([
          tankSummary(db, tank.id),
          tankRanges(db, tank.id),
          db.livestock.where('tank_id').equals(tank.id).filter((l) => attentionLivestock.includes(l.status)).count(),
          db.plants.where('tank_id').equals(tank.id).filter((p) => attentionPlant.includes(p.status)).count(),
        ]);
        // 最新の水温・pH が注意範囲を外れていたら、それも要注意に数える
        const out = (['temp', 'ph'] as const).filter((k) => summary.latest[k] && isOutOfRange(summary.latest[k].value, rangeFor(ranges, k)));
        return { tank, summary, out, attention: sick + poorPlants + out.length };
      }),
    );
  });
  if (!cards) return null;

  const visible = cards.filter((c) => showRemoved || c.tank.status !== 'removed');
  const removedCount = cards.length - cards.filter((c) => c.tank.status !== 'removed').length;
  const backupAt = lastBackupAt();
  const needBackup = cards.length > 0 && (!backupAt || daysSince(backupAt) >= 14);

  return (
    <section>
      <h1 className="mb-3 text-xl font-bold">水槽一覧</h1>

      {needBackup && (
        <Link to="/settings" className="mb-3 block rounded-xl bg-amber-100 p-3 text-sm text-amber-900">
          {backupAt ? `最後のバックアップから${daysSince(backupAt)}日たちました。` : 'まだバックアップがありません。'}
          設定画面から書き出しておきましょう ›
        </Link>
      )}

      {!cards.length && <Empty>まだ水槽がありません。下のボタンから追加してください。</Empty>}

      {visible.map(({ tank, summary, out, attention }) => {
        const temp = summary.latest.temp;
        const ph = summary.latest.ph;
        return (
          <Card key={tank.id} to={`/tanks/${tank.id}`}>
            <div className="flex items-center gap-2">
              <h2 className="flex-1 truncate text-lg font-bold">{tank.name}</h2>
              {attention > 0 && <Badge tone="amber">⚠ 要注意 {attention}</Badge>}
              {tank.status !== 'active' && <Badge>{tankStatusLabels[tank.status]}</Badge>}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <Stat label="水温" value={temp ? `${temp.value.toFixed(1)}℃` : '—'} warn={out.includes('temp')} />
              <Stat label="pH" value={ph ? ph.value.toFixed(1) : '—'} warn={out.includes('ph')} />
              <Stat label="最終換水" value={summary.lastWaterChange ? `${daysSince(summary.lastWaterChange)}日前` : '—'} />
            </div>
            {tank.started_on && <p className="mt-2 text-xs text-slate-500">立ち上げから {daysSince(tank.started_on)}日</p>}
          </Card>
        );
      })}

      {removedCount > 0 && (
        <button type="button" className="mb-2 text-sm text-teal-700" onClick={() => setShowRemoved(!showRemoved)}>
          {showRemoved ? '撤去した水槽を隠す' : `撤去した水槽を表示（${removedCount}）`}
        </button>
      )}

      <Link to="/tanks/new" className={`${btnPrimary} mt-2 block text-center`}>
        ＋ 水槽を追加
      </Link>
    </section>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg py-1 ${warn ? 'bg-red-50' : 'bg-teal-50'}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`font-bold ${warn ? 'text-red-700' : ''}`}>
        {warn && '⚠'}
        {value}
      </div>
    </div>
  );
}
