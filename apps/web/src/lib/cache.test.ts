import { describe, expect, it, vi } from 'vitest';
import { FakeCollection } from '../../test/fakes';

vi.mock('./collections', () => ({}));
const { explainCacheKey, getCached, putCached, translateCacheKey } = await import('./cache');

const base = {
  text: 'echo de menos',
  sentence: 'Echo de menos a mi hermana.',
  sourceLang: 'es',
  targetLang: 'en',
} as const;

describe('cache keys', () => {
  it('ignores case, spacing and wrapping punctuation', () => {
    expect(explainCacheKey({ ...base, text: ' «Echo  de menos» ' }, 'm')).toBe(
      explainCacheKey(base, 'm'),
    );
    expect(explainCacheKey({ ...base, sentence: 'echo de  menos a mi hermana.' }, 'm')).toBe(
      explainCacheKey(base, 'm'),
    );
  });

  it('differs by sentence and direction', () => {
    expect(explainCacheKey({ ...base, sentence: 'Te echo de menos.' }, 'm')).not.toBe(
      explainCacheKey(base, 'm'),
    );
    expect(explainCacheKey({ ...base, sourceLang: 'en', targetLang: 'es' }, 'm')).not.toBe(
      explainCacheKey(base, 'm'),
    );
  });

  it('differs by model', () => {
    expect(explainCacheKey(base, 'a')).not.toBe(explainCacheKey(base, 'b'));
  });

  it('keeps translate and explain keys apart', () => {
    expect(translateCacheKey({ ...base })).not.toBe(explainCacheKey(base, 'm'));
    expect(translateCacheKey({ text: 'hola', targetLang: 'en' })).not.toBe(
      translateCacheKey({ text: 'hola', targetLang: 'en', sourceLang: 'es' }),
    );
  });
});

describe('getCached / putCached', () => {
  it('stores once and counts hits', async () => {
    const coll = new FakeCollection();
    // The fake only implements what the cache uses.
    const c = coll as never;
    expect(await getCached(c, 'h')).toBeNull();
    await putCached(c, 'h', { a: 1 });
    await putCached(c, 'h', { a: 2 });
    expect(await getCached(c, 'h')).toEqual({ a: 1 });
    expect(coll.docs[0]!.hits).toBe(1);
  });
});
