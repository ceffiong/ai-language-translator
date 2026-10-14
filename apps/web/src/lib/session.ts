import 'server-only';
import { apiError } from './api';
import { auth } from './auth';

export interface AuthedUser {
  userId: string;
  email: string;
}

/**
 * Resolves the signed-in user for an API request, from either the session cookie (web
 * app) or an `Authorization: Bearer` token (browser extension). Returns a 401 response
 * when there's no valid session.
 */
export async function requireUser(
  request: Request,
): Promise<{ user: AuthedUser; error?: never } | { user?: never; error: Response }> {
  const session = await getUser(request);
  if (!session) return { error: apiError('unauthorized', 'Please sign in to continue.') };
  return { user: session };
}

/** Like `requireUser`, but returns null instead of an error (for optional auth). */
export async function getUser(request: Request): Promise<AuthedUser | null> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return null;
    return { userId: session.user.id, email: session.user.email };
  } catch {
    return null;
  }
}
