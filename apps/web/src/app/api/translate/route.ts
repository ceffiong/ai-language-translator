import {
  normalizeSelection,
  TranslateRequestSchema,
  type TranslateResponse,
} from '@ai-translator/shared';
import { apiError, parseJson } from '@/lib/api';
import { getCached, putCached, translateCacheKey } from '@/lib/cache';
import { collections } from '@/lib/collections';
import { preflight, withCors } from '@/lib/cors';
import { DeeplError, deeplTranslate } from '@/lib/deepl';
import { consume, identifyClient } from '@/lib/rate-limit';

export const OPTIONS = preflight;

export const POST = withCors(async (request) => {
  const { data: req, error } = await parseJson(request, TranslateRequestSchema);
  if (error) return error;
  const { client, error: clientError } = await identifyClient(request);
  if (clientError) return clientError;

  try {
    const hash = translateCacheKey(req);
    const cached = await getCached(collections.translateCache(), hash);
    if (cached) {
      return Response.json({ ...cached, cached: true } satisfies TranslateResponse);
    }

    const quota = await consume(client, 'translate');
    if (!quota.ok) return quota.response;

    let result;
    try {
      result = await deeplTranslate({
        text: normalizeSelection(req.text),
        context: req.sentence,
        source: req.sourceLang,
        target: req.targetLang,
      });
    } catch (err) {
      await quota.refund();
      return deeplErrorResponse(err);
    }

    await putCached(collections.translateCache(), hash, result);
    return Response.json({ ...result, cached: false } satisfies TranslateResponse);
  } catch (err) {
    console.error('translate failed', err);
    return apiError('internal', 'Something went wrong. Please try again.');
  }
});

function deeplErrorResponse(err: unknown): Response {
  if (!(err instanceof DeeplError)) throw err;
  console.warn(JSON.stringify({ event: 'deepl_error', status: err.status, message: err.message }));
  if (err.status === 429) {
    return apiError('rate_limited', 'Translation is busy right now. Please try again in a moment.');
  }
  return apiError('upstream_error', 'Translation is temporarily unavailable. Please try again.');
}
