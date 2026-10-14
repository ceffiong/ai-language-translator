import { describe, expect, it, vi } from 'vitest';
import { testEnv } from '../../test/fakes';

vi.mock('./env', () => ({ env: () => testEnv() }));

const { preflight, withCors } = await import('./cors');

const CHROME = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const handler = withCors(async () => Response.json({ ok: true }));

function request(origin?: string, method = 'POST') {
  return new Request('http://localhost:3000/api/translate', {
    method,
    headers: origin ? { origin } : {},
  });
}

describe('withCors', () => {
  it('allows a listed Chrome extension and echoes its origin', async () => {
    const res = await handler(request(CHROME));
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(CHROME);
    expect(res.headers.get('Access-Control-Expose-Headers')).toContain('X-Usage-Remaining');
  });

  it('allows Firefox extension origins (random per install)', async () => {
    const res = await handler(request('moz-extension://3f2b1c9e-8a7d-4e6f-b5a4-1c2d3e4f5a6b'));
    expect(res.status).toBe(200);
  });

  it('allows the web app itself and requests without an Origin', async () => {
    expect((await handler(request('http://localhost:3000'))).status).toBe(200);
    expect((await handler(request())).status).toBe(200);
  });

  it('rejects an unknown website with a 403', async () => {
    const res = await handler(request('https://evil.example'));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('forbidden');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('rejects an unlisted Chrome extension', async () => {
    const res = await handler(request(`chrome-extension://${'p'.repeat(32)}`));
    expect(res.status).toBe(403);
  });
});

describe('preflight', () => {
  it('answers allowed origins with 204 and the allowed headers', async () => {
    const res = await preflight(request(CHROME, 'OPTIONS'));
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('X-Install-Id');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  });

  it('rejects unknown origins', async () => {
    expect((await preflight(request('https://evil.example', 'OPTIONS'))).status).toBe(403);
  });
});
