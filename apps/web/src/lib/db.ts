import 'server-only';
import { MongoClient, type Db } from 'mongodb';
import { env } from './env';

// Reuse one client across hot reloads in dev and across invocations of a warm
// serverless function in production.
const globalForMongo = globalThis as typeof globalThis & { __mongoClient?: MongoClient };

export function mongoClient(): MongoClient {
  if (!globalForMongo.__mongoClient) {
    globalForMongo.__mongoClient = new MongoClient(env().MONGODB_URI, {
      appName: 'ai-language-translator',
      maxPoolSize: 10,
    });
  }
  return globalForMongo.__mongoClient;
}

/** The app database (named in the connection string, e.g. `/ai_translator`). */
export function db(): Db {
  return mongoClient().db();
}
