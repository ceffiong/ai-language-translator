import { beforeEach, describe, expect, it, vi } from 'vitest';

// Plain stub rather than vi.fn(): Vitest 5 reports rejections from reset vi.fn() mocks
// as test failures even when the code under test catches them.
type GetSession = (args: { headers: Headers }) => Promise<unknown>;
let impl: GetSession = async () => null;
const calls: { headers: Headers }[] = [];
const getSession = {
  mockReset: () => {
    impl = async () => null;
    calls.length = 0;
  },
  mockResolvedValue: (value: unknown) => {
    impl = async () => value;
  },
  mockImplementation: (fn: GetSession) => {
    impl = fn;
  },
};
vi.mock('./auth', () => ({
  auth: {
    api: {
      getSession: (args: { headers: Headers }) => {
        calls.push(args);
        return impl(args);
      },
    },
  },
}));

const { getUser, requireUser } = await import('./session');

function request(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/cards', { headers });
}

describe('requireUser', () => {
  beforeEach(() => getSession.mockReset());

  it('returns the user for a cookie session', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', email: 'a@b.co' } });
    const result = await requireUser(request({ cookie: 'better-auth.session_token=abc' }));
    expect(result.user).toEqual({ userId: 'u1', email: 'a@b.co' });
    expect(calls[0]!.headers.get('cookie')).toContain('session_token');
  });

  it('passes the bearer token through for the extension', async () => {
    getSession.mockResolvedValue({ user: { id: 'u2', email: 'x@y.co' } });
    const result = await requireUser(request({ authorization: 'Bearer tok123' }));
    expect(result.user?.userId).toBe('u2');
    expect(calls[0]!.headers.get('authorization')).toBe('Bearer tok123');
  });

  it('returns a 401 response when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const result = await requireUser(request());
    expect(result.user).toBeUndefined();
    expect(result.error?.status).toBe(401);
    expect(await result.error?.json()).toEqual({
      error: { code: 'unauthorized', message: 'Please sign in to continue.' },
    });
  });

  it('treats an invalid or expired token as signed out', async () => {
    getSession.mockImplementation(async () => {
      throw new Error('invalid token');
    });
    expect(await getUser(request({ authorization: 'Bearer bad' }))).toBeNull();
    expect((await requireUser(request({ authorization: 'Bearer bad' }))).error?.status).toBe(401);
  });
});
