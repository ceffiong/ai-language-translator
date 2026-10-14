import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeCollection, testEnv } from '../../../../test/fakes';

const usage = new FakeCollection();
const translateCache = new FakeCollection();
const deeplCalls: unknown[] = [];
// Plain function rather than vi.fn(): see the note in waitlist/route.test.ts.
let deeplImpl: () => Promise<unknown> = async () => ({
  translation: 'I miss',
  detectedSourceLang: 'es',
});

vi.mock('@/lib/env', () => ({ env: () => testEnv() }));
vi.mock('@/lib/session', () => ({ getUser: async () => null }));
vi.mock('@/lib/collections', () => ({
  collections: { usage: () => usage, translateCache: () => translateCache },
}));
vi.mock('@/lib/deepl', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/deepl')>()),
  deeplTranslate: (input: unknown) => {
    deeplCalls.push(input);
    return deeplImpl();
  },
}));

const { POST, OPTIONS } = await import('./route');
const { DeeplError } = await import('@/lib/deepl');

const INSTALL_ID = '0b5c3a1e-4f6d-4c2b-9a8e-7d6f5e4c3b2a';

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost:3000/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Install-Id': INSTALL_ID, ...headers },
    body: JSON.stringify(body),
  });
}

const body = { text: 'echo de menos', sentence: 'Echo de menos a mi hermana.', targetLang: 'en' };

describe('POST /api/translate', () => {
  beforeEach(() => {
    usage.docs = [];
    translateCache.docs = [];
    deeplCalls.length = 0;
    deeplImpl = async () => ({ translation: 'I miss', detectedSourceLang: 'es' });
  });

  it('translates with the sentence as context', async () => {
    const res = await POST(post(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      translation: 'I miss',
      detectedSourceLang: 'es',
      cached: false,
    });
    expect(deeplCalls[0]).toEqual({
      text: 'echo de menos',
      context: 'Echo de menos a mi hermana.',
      source: undefined,
      target: 'en',
    });
  });

  it('serves the second identical request from the cache, free', async () => {
    await POST(post(body));
    const res = await POST(post({ ...body, text: ' Echo de menos ' }));
    expect((await res.json()).cached).toBe(true);
    expect(deeplCalls).toHaveLength(1);
    expect(usage.docs.find((d) => String(d.key).startsWith('anon:'))?.count).toBe(1);
  });

  it('rejects invalid input and a missing install ID with 400', async () => {
    expect((await POST(post({ text: '', targetLang: 'en' }))).status).toBe(400);
    expect((await POST(post({ ...body, targetLang: 'fr' }))).status).toBe(400);
    expect((await POST(post(body, { 'X-Install-Id': '' }))).status).toBe(400);
  });

  it('maps a DeepL 429 to a 429 and refunds the quota', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    deeplImpl = async () => {
      throw new DeeplError(429, 'DeepL returned 429');
    };
    const res = await POST(post(body));
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe('rate_limited');
    expect(usage.docs.every((d) => d.count === 0)).toBe(true);
  });

  it('maps other DeepL failures to a 502 without leaking details', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    deeplImpl = async () => {
      throw new DeeplError(456, 'DeepL returned 456');
    };
    const res = await POST(post(body));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain('456');
  });

  it('rejects requests from unknown websites', async () => {
    const res = await POST(post(body, { Origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
    expect(deeplCalls).toHaveLength(0);
  });

  it('answers CORS preflight for the extension', async () => {
    const res = await OPTIONS(
      new Request('http://localhost:3000/api/translate', {
        method: 'OPTIONS',
        headers: { Origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop' },
      }),
    );
    expect(res.status).toBe(204);
  });
});
