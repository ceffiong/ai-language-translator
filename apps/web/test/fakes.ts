/**
 * A tiny in-memory stand-in for a MongoDB collection, supporting just the operations the
 * rate limiter and cache use: equality filters, `$inc`, `$set` and `$setOnInsert`.
 */
type Doc = Record<string, unknown>;

interface Update {
  $inc?: Record<string, number>;
  $set?: Doc;
  $setOnInsert?: Doc;
}

export class FakeCollection {
  docs: Doc[] = [];

  private find(filter: Doc) {
    return this.docs.find((doc) => Object.entries(filter).every(([k, v]) => doc[k] === v));
  }

  private apply(filter: Doc, update: Update, upsert: boolean) {
    let doc = this.find(filter);
    if (!doc) {
      if (!upsert) return null;
      doc = { ...filter, ...update.$setOnInsert };
      this.docs.push(doc);
    }
    for (const [k, by] of Object.entries(update.$inc ?? {})) {
      doc[k] = ((doc[k] as number | undefined) ?? 0) + by;
    }
    Object.assign(doc, update.$set);
    return doc;
  }

  async findOne(filter: Doc) {
    const doc = this.find(filter);
    return doc ? { ...doc } : null;
  }

  async findOneAndUpdate(filter: Doc, update: Update, options: { upsert?: boolean } = {}) {
    const doc = this.apply(filter, update, options.upsert ?? false);
    return doc ? { ...doc } : null;
  }

  async updateOne(filter: Doc, update: Update, options: { upsert?: boolean } = {}) {
    this.apply(filter, update, options.upsert ?? false);
    return { acknowledged: true };
  }
}

export function testEnv(overrides: Record<string, unknown> = {}) {
  return {
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3000',
    DEEPL_API_KEY: 'test-deepl-key:fx',
    DEEPL_API_URL: 'https://api-free.deepl.com',
    GEMINI_API_KEY: 'test-gemini-key',
    GEMINI_MODEL: 'gemini-test',
    GEMINI_THINKING: 'minimal',
    EXTENSION_IDS: ['abcdefghijklmnopabcdefghijklmnop'],
    ANON_DAILY_LIMIT: 30,
    ...overrides,
  };
}
