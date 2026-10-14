import 'server-only';
import { env } from './env';

export type MeteredAction = 'explain' | 'translate';

/**
 * Daily limits per UTC day. The free explanation limit is a promise to users: it may
 * be raised but must never be lowered after launch.
 */
export function dailyLimits(): Record<MeteredAction, { perClient: number; perIp: number }> {
  return {
    // Same limit for anonymous installs and signed-in free users.
    explain: { perClient: env().ANON_DAILY_LIMIT, perIp: 300 },
    // Translation is cheap; this limit only exists to stop abuse.
    translate: { perClient: 300, perIp: 3000 },
  };
}
