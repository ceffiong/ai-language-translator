import type { ApiError } from '@ai-translator/shared';
import type { z } from 'zod';

type ErrorCode = ApiError['error']['code'];

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  quota_exceeded: 429,
  rate_limited: 429,
  upstream_error: 502,
  internal: 500,
};

export function apiError(code: ErrorCode, message: string, init?: ResponseInit): Response {
  const body: ApiError = { error: { code, message } };
  return Response.json(body, { ...init, status: STATUS[code] });
}

/** Parses a JSON body against a schema, returning either the data or a 400 response. */
export async function parseJson<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ data: z.infer<S>; error?: never } | { data?: never; error: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { error: apiError('bad_request', 'Request body must be valid JSON.') };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.length ? `${first.path.join('.')}: ` : '';
    return { error: apiError('bad_request', `${where}${first?.message ?? 'Invalid request.'}`) };
  }
  return { data: parsed.data };
}
