import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateOne = vi.fn();
// Set to make the database call fail. A plain function, because Vitest 5 reports
// rejections from reset vi.fn() mocks as failures even when the route catches them.
let failWith: Error | null = null;
vi.mock('@/lib/collections', () => ({
  collections: {
    waitlist: () => ({
      updateOne: async (...args: unknown[]) => {
        if (failWith) throw failWith;
        return updateOne(...args);
      },
    }),
  },
}));

const { POST } = await import('./route');

function post(body: unknown, query = '') {
  return new Request(`http://localhost/api/waitlist${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/waitlist', () => {
  beforeEach(() => {
    failWith = null;
    updateOne.mockReset().mockResolvedValue({ acknowledged: true });
  });

  it('upserts a normalized email', async () => {
    const res = await POST(post({ email: '  Learner@Example.com ' }, '?ref=reddit'));
    expect(res.status).toBe(200);
    const [filter, update, options] = updateOne.mock.calls[0]!;
    expect(filter).toEqual({ email: 'learner@example.com', source: 'landing' });
    expect(update.$setOnInsert).toMatchObject({ email: 'learner@example.com', ref: 'reddit' });
    expect(options).toEqual({ upsert: true });
  });

  it('is idempotent: joining twice uses the same upsert key', async () => {
    await POST(post({ email: 'a@b.co' }));
    await POST(post({ email: 'A@B.co' }));
    expect(updateOne.mock.calls[0]![0]).toEqual(updateOne.mock.calls[1]![0]);
  });

  it('rejects an invalid email with a 400', async () => {
    const res = await POST(post({ email: 'nope' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('bad_request');
    expect(updateOne).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON', async () => {
    const res = await POST(post('{not json'));
    expect(res.status).toBe(400);
  });

  it('returns 500 without leaking details when the database fails', async () => {
    failWith = new Error('connection string with secrets');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(post({ email: 'a@b.co' }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secrets');
  });
});
