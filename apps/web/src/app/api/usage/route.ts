import type { UsageResponse } from '@ai-translator/shared';
import { apiError } from '@/lib/api';
import { preflight, withCors } from '@/lib/cors';
import { identifyClient, remaining } from '@/lib/rate-limit';

export const OPTIONS = preflight;

/** How many free explanations the caller has left today (for the extension popup). */
export const GET = withCors(async (request) => {
  const { client, error } = await identifyClient(request);
  if (error) return error;
  try {
    const explanations = await remaining(client, 'explain');
    return Response.json({ explanations } satisfies UsageResponse, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('usage failed', err);
    return apiError('internal', 'Something went wrong. Please try again.');
  }
});
