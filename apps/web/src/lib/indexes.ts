// Index definitions for every app-owned collection. Kept free of server-only imports
// so `scripts/ensure-indexes.ts` can run it directly with Node.
import type { CreateIndexesOptions, Db, IndexSpecification } from 'mongodb';

interface IndexDef {
  collection: string;
  key: IndexSpecification;
  options?: CreateIndexesOptions;
}

export const INDEXES: IndexDef[] = [
  { collection: 'cards', key: { userId: 1, due: 1 } },
  { collection: 'cards', key: { userId: 1, createdAt: -1 } },
  {
    collection: 'cards',
    key: { userId: 1, textKey: 1, direction: 1 },
    options: { unique: true, name: 'unique_card_per_user' },
  },
  { collection: 'reviewLogs', key: { userId: 1, reviewedAt: -1 } },
  { collection: 'usage', key: { key: 1, day: 1 }, options: { unique: true } },
  { collection: 'usage', key: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } },
  { collection: 'explainCache', key: { hash: 1 }, options: { unique: true } },
  { collection: 'translateCache', key: { hash: 1 }, options: { unique: true } },
  { collection: 'waitlist', key: { email: 1, source: 1 }, options: { unique: true } },
];

export async function ensureIndexes(db: Db): Promise<string[]> {
  const created: string[] = [];
  for (const { collection, key, options } of INDEXES) {
    const name = await db.collection(collection).createIndex(key, options ?? {});
    created.push(`${collection}.${name}`);
  }
  return created;
}
