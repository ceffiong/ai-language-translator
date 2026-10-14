import 'server-only';
import { createHmac } from 'node:crypto';
import { MongoServerError } from 'mongodb';
import { apiError } from './api';
import { collections } from './collections';
import { env } from './env';
import { dailyLimits, type MeteredAction } from './limits';
import { getUser } from './session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Who is making a request, for metering: a signed-in user or an anonymous install. */
export interface Client {
  /** `user:<userId>` or `anon:<installId>`. */
  id: string;
  userId: string | null;
  /** Keyed hash of the caller's IP, or null when unknown (e.g. local dev). */
  ipHash: string | null;
}

/**
 * Identifies the caller. Signed-in users are metered by account; everyone else must send
 * a random install ID in `X-Install-Id`. Returns a 400 response if neither is present.
 */
export async function identifyClient(
  request: Request,
): Promise<{ client: Client; error?: never } | { client?: never; error: Response }> {
  const ipHash = hashIp(clientIp(request));
  const user = await getUser(request);
  if (user) return { client: { id: `user:${user.userId}`, userId: user.userId, ipHash } };

  const installId = request.headers.get('x-install-id');
  if (!installId || !UUID.test(installId)) {
    return { error: apiError('bad_request', 'Missing or invalid X-Install-Id header.') };
  }
  return { client: { id: `anon:${installId.toLowerCase()}`, userId: null, ipHash } };
}

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || null;
}

/** We never store raw IPs, only a keyed hash that can't be reversed without our secret. */
function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHmac('sha256', env().BETTER_AUTH_SECRET).update(ip).digest('base64url').slice(0, 22);
}

/** The UTC day a usage counter belongs to, e.g. `2026-10-14`. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function usageKey(subject: string, action: MeteredAction) {
  return `${subject}:${action}`;
}

/**
 * Atomically adds one to a daily counter. If that takes it over the limit, the
 * increment is undone and the call is rejected.
 */
async function increment(key: string, limit: number, now: Date) {
  const day = utcDay(now);
  const expiresAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const run = () =>
    collections
      .usage()
      .findOneAndUpdate(
        { key, day },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
        { upsert: true, returnDocument: 'after' },
      );
  let doc;
  try {
    doc = await run();
  } catch (err) {
    // Two concurrent first requests of the day can race on the upsert; the loser retries.
    if (err instanceof MongoServerError && err.code === 11000) doc = await run();
    else throw err;
  }
  const count = doc?.count ?? 1;
  if (count > limit) {
    await decrement(key, now);
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: limit - count };
}

async function decrement(key: string, now: Date) {
  await collections.usage().updateOne({ key, day: utcDay(now) }, { $inc: { count: -1 } });
}

export type ConsumeResult =
  | { ok: true; remaining: number; refund: () => Promise<void>; response?: never }
  | { ok: false; response: Response; remaining?: never; refund?: never };

/**
 * Uses one unit of the client's daily quota for an action, plus the per-IP backstop.
 * Call `refund()` if the upstream call then fails, so errors don't cost the user.
 */
export async function consume(
  client: Client,
  action: MeteredAction,
  now = new Date(),
): Promise<ConsumeResult> {
  const limits = dailyLimits()[action];
  const clientKey = usageKey(client.id, action);
  const own = await increment(clientKey, limits.perClient, now);
  if (!own.allowed) {
    const message =
      action === 'explain'
        ? `You've used all ${limits.perClient} free explanations for today. They reset at midnight UTC.`
        : `You've reached today's translation limit. It resets at midnight UTC.`;
    return { ok: false, response: apiError('quota_exceeded', message, remainingHeader(0)) };
  }

  const ipKey = client.ipHash ? usageKey(`ip:${client.ipHash}`, action) : null;
  if (ipKey) {
    const ip = await increment(ipKey, limits.perIp, now);
    if (!ip.allowed) {
      await decrement(clientKey, now);
      return {
        ok: false,
        response: apiError(
          'rate_limited',
          'Too many requests from your network today. Please try again tomorrow.',
        ),
      };
    }
  }

  return {
    ok: true,
    remaining: own.remaining,
    refund: async () => {
      await decrement(clientKey, now);
      if (ipKey) await decrement(ipKey, now);
    },
  };
}

/** How many uses of an action the client has left today, without using one. */
export async function remaining(client: Client, action: MeteredAction, now = new Date()) {
  const limit = dailyLimits()[action].perClient;
  const doc = await collections
    .usage()
    .findOne({ key: usageKey(client.id, action), day: utcDay(now) });
  return { limit, remaining: Math.max(0, limit - (doc?.count ?? 0)) };
}

export function remainingHeader(remaining: number): ResponseInit {
  return { headers: { 'X-Usage-Remaining': String(remaining) } };
}
