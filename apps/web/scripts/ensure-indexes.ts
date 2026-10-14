// Creates (or confirms) every MongoDB index the app relies on. Safe to re-run.
// Usage: pnpm --filter web db:indexes
import { MongoClient } from 'mongodb';
import { ensureIndexes } from '../src/lib/indexes.ts';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set (expected in apps/web/.env.local).');
  process.exit(1);
}

const client = new MongoClient(uri);
try {
  const db = client.db();
  const created = await ensureIndexes(db);
  console.log(`Database "${db.databaseName}": ${created.length} indexes ensured`);
  for (const name of created) console.log(`  ✓ ${name}`);
} finally {
  await client.close();
}
