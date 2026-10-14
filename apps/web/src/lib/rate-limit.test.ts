import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeCollection, testEnv } from '../../test/fakes';

const usage = new FakeCollection();
let signedIn: { userId: string; email: string } | null = null;

vi.mock('./env', () => ({ env: () => testEnv() }));
vi.mock('./collections', () => ({ collections: { usage: () => usage } }));
vi.mock('./session', () => ({ getUser: async () => signedIn }));

const { consume, identifyClient, remaining, utcDay } = await import('./rate-limit');

const INSTALL_ID = '0b5c3a1e-4f6d-4c2b-9a8e-7d6f5e4c3b2a';
const DAY = new Date('2026-10-14T12:00:00Z');

function request(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/explain', { method: 'POST', headers });
}

async function anonClient(ip = '203.0.113.7') {
  const { client } = await identifyClient(
    request({ 'x-install-id': INSTALL_ID, 'x-forwarded-for': `${ip}, 10.0.0.1` }),
  );
  return client!;
}

describe('identifyClient', () => {
  beforeEach(() => {
    signedIn = null;
  });

  it('meters anonymous users by install ID and hashes their IP', async () => {
    const client = await anonClient();
    expect(client.id).toBe(`anon:${INSTALL_ID}`);
    expect(client.userId).toBeNull();
    expect(client.ipHash).toMatch(/^[\w-]{22}$/);
    expect(client.ipHash).not.toContain('203');
  });

  it('meters signed-in users by account, even without an install ID', async () => {
    signedIn = { userId: 'u1', email: 'a@b.co' };
    const { client } = await identifyClient(request());
    expect(client?.id).toBe('user:u1');
  });

  it('rejects anonymous requests without a valid install ID', async () => {
    expect((await identifyClient(request())).error?.status).toBe(400);
    expect((await identifyClient(request({ 'x-install-id': 'nope' }))).error?.status).toBe(400);
  });
});

describe('consume', () => {
  beforeEach(() => {
    usage.docs = [];
    signedIn = null;
  });

  it('allows 30 explanations a day, then returns a friendly 429', async () => {
    const client = await anonClient();
    for (let i = 1; i <= 30; i++) {
      const result = await consume(client, 'explain', DAY);
      expect(result.ok).toBe(true);
      expect(result.remaining).toBe(30 - i);
    }
    const blocked = await consume(client, 'explain', DAY);
    expect(blocked.ok).toBe(false);
    expect(blocked.response?.status).toBe(429);
    expect(blocked.response?.headers.get('X-Usage-Remaining')).toBe('0');
    const body = await blocked.response!.json();
    expect(body.error.code).toBe('quota_exceeded');
    expect(body.error.message).toContain('30 free explanations');
  });

  it('does not count rejected calls, so the counter stays at the limit', async () => {
    const client = await anonClient();
    for (let i = 0; i < 35; i++) await consume(client, 'explain', DAY);
    expect((await remaining(client, 'explain', DAY)).remaining).toBe(0);
    const own = usage.docs.find((d) => d.key === `anon:${INSTALL_ID}:explain`);
    expect(own?.count).toBe(30);
  });

  it('resets on the next UTC day', async () => {
    const client = await anonClient();
    for (let i = 0; i < 30; i++) await consume(client, 'explain', DAY);
    expect((await consume(client, 'explain', DAY)).ok).toBe(false);
    const nextDay = new Date('2026-10-15T00:00:01Z');
    expect(utcDay(nextDay)).toBe('2026-10-15');
    expect((await consume(client, 'explain', nextDay)).ok).toBe(true);
  });

  it('sets counters to expire after two days', async () => {
    await consume(await anonClient(), 'explain', DAY);
    expect(usage.docs[0]!.expiresAt).toEqual(new Date('2026-10-16T12:00:00Z'));
  });

  it('meters translations separately from explanations', async () => {
    const client = await anonClient();
    for (let i = 0; i < 30; i++) await consume(client, 'explain', DAY);
    const translate = await consume(client, 'translate', DAY);
    expect(translate.ok).toBe(true);
    expect(translate.remaining).toBe(299);
  });

  it('refunds a failed call', async () => {
    const client = await anonClient();
    const result = await consume(client, 'explain', DAY);
    await result.refund!();
    expect((await remaining(client, 'explain', DAY)).remaining).toBe(30);
    expect(usage.docs.every((d) => d.count === 0)).toBe(true);
  });

  it('blocks install-ID cycling with the per-IP backstop', async () => {
    let blocked;
    for (let i = 0; i < 301; i++) {
      const id = `0b5c3a1e-4f6d-4c2b-9a8e-${String(i).padStart(12, '0')}`;
      const { client } = await identifyClient(
        request({ 'x-install-id': id, 'x-forwarded-for': '198.51.100.9' }),
      );
      blocked = await consume(client!, 'explain', DAY);
    }
    expect(blocked?.ok).toBe(false);
    expect((await blocked!.response!.json()).error.code).toBe('rate_limited');
  });
});
