import 'server-only';
import { createHash } from 'node:crypto';
import { MongoServerError, type Collection } from 'mongodb';
import {
  normalizeKey,
  PROMPT_VERSION,
  type ExplainRequest,
  type TranslateRequest,
} from '@ai-translator/shared';
import type { CacheDoc } from './collections';

/** Bump to invalidate cached translations (e.g. if DeepL options change). */
export const TRANSLATE_CACHE_VERSION = 'deepl-v1';

function normalizeSentence(sentence: string | undefined): string {
  return (sentence ?? '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function sha256(parts: string[]): string {
  // The unit separator can't appear in normalized text, so parts can't run together.
  return createHash('sha256').update(parts.join('\u001f')).digest('hex');
}

/** `variant` (model and settings) is part of the key so a switch doesn't serve old answers. */
export function explainCacheKey(req: ExplainRequest, variant: string): string {
  return sha256([
    PROMPT_VERSION,
    variant,
    normalizeKey(req.text),
    normalizeSentence(req.sentence),
    req.sourceLang,
    req.targetLang,
  ]);
}

export function translateCacheKey(req: TranslateRequest): string {
  return sha256([
    TRANSLATE_CACHE_VERSION,
    normalizeKey(req.text),
    normalizeSentence(req.sentence),
    req.sourceLang ?? 'auto',
    req.targetLang,
  ]);
}

/** Returns the cached value for a hash (and counts the hit), or null. */
export async function getCached<T>(
  collection: Collection<CacheDoc<T>>,
  hash: string,
): Promise<T | null> {
  const doc = await collection.findOneAndUpdate(
    { hash },
    { $inc: { hits: 1 } },
    { returnDocument: 'after' },
  );
  return doc ? (doc.value as T) : null;
}

/** Stores a value. If another request stored it first, the existing entry is kept. */
export async function putCached<T>(
  collection: Collection<CacheDoc<T>>,
  hash: string,
  value: T,
  now = new Date(),
): Promise<void> {
  try {
    await collection.updateOne(
      { hash },
      // Cast: the driver's generic update types can't see through `T`.
      { $setOnInsert: { hash, value, createdAt: now, hits: 0 } as never },
      { upsert: true },
    );
  } catch (err) {
    // A concurrent identical request won the upsert race; its entry is just as good.
    if (!(err instanceof MongoServerError && err.code === 11000)) throw err;
  }
}
