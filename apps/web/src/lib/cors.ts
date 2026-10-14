import 'server-only';
import { apiError } from './api';
import { env } from './env';

/**
 * Which browser origins may call the API. Chrome extension IDs are fixed and listed in
 * `EXTENSION_IDS`. Firefox gives every install a random `moz-extension://<uuid>` origin,
 * so any Firefox extension origin is accepted. Websites can't use either scheme, which
 * is what this check is for; non-browser clients are handled by rate limits instead.
 */
export function isAllowedOrigin(origin: string, request: Request): boolean {
  if (origin === new URL(request.url).origin) return true;
  if (origin === new URL(env().BETTER_AUTH_URL).origin) return true;
  const chrome = /^chrome-extension:\/\/([a-p]{32})$/.exec(origin);
  if (chrome) return env().EXTENSION_IDS.includes(chrome[1]!);
  return /^moz-extension:\/\/[0-9a-f-]{36}$/i.test(origin);
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Install-Id',
    'Access-Control-Expose-Headers': 'X-Usage-Remaining',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

type Handler = (request: Request) => Promise<Response>;

/**
 * Wraps a route handler: rejects requests from unknown origins with a 403 and adds CORS
 * headers for allowed ones. Requests without an `Origin` header (curl, server-side)
 * pass through; they're still subject to auth and rate limits.
 */
export function withCors(handler: Handler): Handler {
  return async (request) => {
    const origin = request.headers.get('origin');
    if (origin && !isAllowedOrigin(origin, request)) return forbidden();
    const response = await handler(request);
    if (origin) {
      for (const [name, value] of Object.entries(corsHeaders(origin))) {
        response.headers.set(name, value);
      }
    }
    return response;
  };
}

/** Handles `OPTIONS` preflight requests. */
export async function preflight(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  if (!origin || !isAllowedOrigin(origin, request)) return forbidden();
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

function forbidden() {
  return apiError('forbidden', 'This origin is not allowed to use the API.');
}
