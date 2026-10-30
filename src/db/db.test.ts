import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { AquariumDB } from './db';

describe('AquariumDB', () => {
  it('水槽を保存して読み出せる', async () => {
    const db = new AquariumDB('test-db');
    const now = new Date().toISOString();
    await db.tanks.add({ id: 't1', name: 'リビング60cm', status: 'active', created_at: now, updated_at: now });
    expect((await db.tanks.get('t1'))?.name).toBe('リビング60cm');
    db.close();
  });
});
