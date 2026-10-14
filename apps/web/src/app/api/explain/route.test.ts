import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExplainStreamEvent, Explanation } from '@ai-translator/shared';
import { FakeCollection, testEnv } from '../../../../test/fakes';

const usage = new FakeCollection();
const explainCache = new FakeCollection();

const EXPLANATION: Explanation = {
  meaningInContext: 'I miss (my sister).',
  nuance: '"Echar de menos" is usual in Spain; Latin America prefers "extrañar".',
  register: 'neutral',
  grammarNote: null,
  examples: [
    { source: 'Te echo de menos.', translation: 'I miss you.' },
    { source: 'Echamos de menos el mar.', translation: 'We miss the sea.' },
  ],
  ipa: '/ˈe.tʃo ðe ˈme.nos/',
  partOfSpeech: 'verb phrase',
  lemma: 'echar de menos',
};

type Attempt = (onText: (t: string) => void) => Promise<{ explanation: Explanation | null }>;
const good: Attempt = async (onText) => {
  onText('{"meaningInContext":');
  onText('"I miss"}');
  return { explanation: EXPLANATION };
};
const invalid: Attempt = async (onText) => {
  onText('{"oops"');
  return { explanation: null };
};
// Plain functions rather than vi.fn(): see the note in waitlist/route.test.ts.
let attempts: Attempt[] = [];
let calls = 0;

vi.mock('@/lib/env', () => ({ env: () => testEnv() }));
vi.mock('@/lib/session', () => ({ getUser: async () => null }));
vi.mock('@/lib/collections', () => ({
  collections: { usage: () => usage, explainCache: () => explainCache },
}));
vi.mock('@/lib/claude', () => ({
  generateExplanation: (_req: unknown, onText: (t: string) => void) => {
    const attempt = attempts[calls++] ?? good;
    return attempt(onText);
  },
}));

const { POST } = await import('./route');
const { APIError } = await import('@anthropic-ai/sdk');

const INSTALL_ID = '0b5c3a1e-4f6d-4c2b-9a8e-7d6f5e4c3b2a';
const body = {
  text: 'echo de menos',
  sentence: 'Desde que se fue, echo de menos a mi hermana.',
  sourceLang: 'es',
  targetLang: 'en',
};

function post(payload: unknown = body) {
  return new Request('http://localhost:3000/api/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Install-Id': INSTALL_ID },
    body: JSON.stringify(payload),
  });
}

async function events(res: Response): Promise<ExplainStreamEvent[]> {
  const text = await res.text();
  return text
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
}

const anonCount = () => usage.docs.find((d) => d.key === `anon:${INSTALL_ID}:explain`)?.count;

describe('POST /api/explain', () => {
  beforeEach(() => {
    usage.docs = [];
    explainCache.docs = [];
    attempts = [];
    calls = 0;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('streams deltas, then the validated explanation', async () => {
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/x-ndjson');
    expect(res.headers.get('X-Usage-Remaining')).toBe('29');
    expect(await events(res)).toEqual([
      { type: 'delta', text: '{"meaningInContext":' },
      { type: 'delta', text: '"I miss"}' },
      { type: 'done', explanation: EXPLANATION, cached: false },
    ]);
  });

  it('serves the second identical request from the cache without calling Claude or counting it', async () => {
    await (await POST(post())).text();
    const res = await POST(post());
    expect(await events(res)).toEqual([{ type: 'done', explanation: EXPLANATION, cached: true }]);
    expect(calls).toBe(1);
    expect(anonCount()).toBe(1);
    expect(res.headers.get('X-Usage-Remaining')).toBe('29');
  });

  it('retries once after invalid output, telling the client to reset', async () => {
    attempts = [invalid, good];
    const types = (await events(await POST(post()))).map((e) => e.type);
    expect(types).toEqual(['delta', 'reset', 'delta', 'delta', 'done']);
    expect(calls).toBe(2);
  });

  it('returns a friendly error and refunds the quota when both attempts fail', async () => {
    attempts = [invalid, invalid];
    const all = await events(await POST(post()));
    expect(all.at(-1)).toEqual({
      type: 'error',
      error: {
        code: 'upstream_error',
        message: "Couldn't explain this right now. Please try again.",
      },
    });
    expect(anonCount()).toBe(0);
    expect(explainCache.docs).toHaveLength(0);
  });

  it('does not retry errors a retry cannot fix (e.g. billing)', async () => {
    const billing: Attempt = async () => {
      throw new APIError(400, undefined, 'credit balance too low', new Headers());
    };
    attempts = [billing, good];
    const all = await events(await POST(post()));
    expect(all.map((e) => e.type)).toEqual(['error']);
    expect(calls).toBe(1);
    expect(anonCount()).toBe(0);
  });

  it('retries a server error', async () => {
    const overloaded: Attempt = async () => {
      throw new APIError(529, undefined, 'overloaded', new Headers());
    };
    attempts = [overloaded, good];
    expect((await events(await POST(post()))).at(-1)?.type).toBe('done');
  });

  it('returns 429 on the 31st explanation of the day', async () => {
    for (let i = 0; i < 30; i++) {
      await (await POST(post({ ...body, sentence: `Frase ${i}: echo de menos.` }))).text();
    }
    const res = await POST(post({ ...body, sentence: 'Otra frase más.' }));
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe('quota_exceeded');
    expect(res.headers.get('X-Usage-Remaining')).toBe('0');
  });

  it('still serves cached explanations after the daily limit', async () => {
    await (await POST(post())).text();
    for (let i = 0; i < 29; i++) {
      await (await POST(post({ ...body, sentence: `Frase ${i}: echo de menos.` }))).text();
    }
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect((await events(res))[0]).toMatchObject({ type: 'done', cached: true });
  });

  it('rejects the same language on both sides', async () => {
    expect((await POST(post({ ...body, targetLang: 'es' }))).status).toBe(400);
  });
});
