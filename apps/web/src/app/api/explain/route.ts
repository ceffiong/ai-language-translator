import { APIError } from '@anthropic-ai/sdk';
import { ExplainRequestSchema, type ExplainStreamEvent } from '@ai-translator/shared';
import { apiError, parseJson } from '@/lib/api';
import { explainCacheKey, getCached, putCached } from '@/lib/cache';
import { generateExplanation } from '@/lib/claude';
import { collections } from '@/lib/collections';
import { preflight, withCors } from '@/lib/cors';
import { consume, identifyClient, remaining } from '@/lib/rate-limit';

export const OPTIONS = preflight;

const ATTEMPTS = 2;

/**
 * Streams an explanation as newline-delimited JSON (see `ExplainStreamEvent`). Cache
 * hits are free and return a single `done` event. Every response carries
 * `X-Usage-Remaining`, the number of free explanations left today.
 */
export const POST = withCors(async (request) => {
  const { data: req, error } = await parseJson(request, ExplainRequestSchema);
  if (error) return error;
  const { client, error: clientError } = await identifyClient(request);
  if (clientError) return clientError;

  let hash: string;
  let quota;
  try {
    hash = explainCacheKey(req);
    const cached = await getCached(collections.explainCache(), hash);
    if (cached) {
      const usage = await remaining(client, 'explain');
      return ndjson([{ type: 'done', explanation: cached, cached: true }], usage.remaining);
    }
    quota = await consume(client, 'explain');
    if (!quota.ok) return quota.response;
  } catch (err) {
    console.error('explain failed before streaming', err);
    return apiError('internal', 'Something went wrong. Please try again.');
  }

  const { refund } = quota;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ExplainStreamEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
        } catch {
          // The client went away; generation is aborted through request.signal.
        }
      };

      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        if (attempt > 1) send({ type: 'reset' });
        try {
          const { explanation } = await generateExplanation(
            req,
            (text) => send({ type: 'delta', text }),
            request.signal,
          );
          if (explanation) {
            await putCached(collections.explainCache(), hash, explanation).catch((err) =>
              console.error('explain cache write failed', err),
            );
            send({ type: 'done', explanation, cached: false });
            controller.close();
            return;
          }
          console.warn(JSON.stringify({ event: 'explain_invalid_output', attempt }));
        } catch (err) {
          if (request.signal.aborted) {
            controller.close();
            return;
          }
          const status = err instanceof APIError ? err.status : undefined;
          console.warn(
            JSON.stringify({
              event: 'explain_error',
              attempt,
              status,
              message: err instanceof Error ? err.message.slice(0, 300) : String(err),
            }),
          );
          // Bad requests, auth and billing errors won't fix themselves on a retry.
          if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) break;
        }
      }

      // Generation failed: the user shouldn't pay for our error.
      await refund().catch((err) => console.error('explain refund failed', err));
      send({
        type: 'error',
        error: {
          code: 'upstream_error',
          message: "Couldn't explain this right now. Please try again.",
        },
      });
      controller.close();
    },
  });

  return new Response(body, { headers: streamHeaders(quota.remaining) });
});

function streamHeaders(remainingToday: number): HeadersInit {
  return {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Usage-Remaining': String(remainingToday),
  };
}

function ndjson(events: ExplainStreamEvent[], remainingToday: number): Response {
  const text = events.map((e) => JSON.stringify(e) + '\n').join('');
  return new Response(text, { headers: streamHeaders(remainingToday) });
}
