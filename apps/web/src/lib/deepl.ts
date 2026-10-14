import 'server-only';
import { fromDeeplSource, LANGUAGES, type LanguageCode } from '@ai-translator/shared';
import { env } from './env';

const TIMEOUT_MS = 5000;

export interface DeeplInput {
  text: string;
  /** Surrounding sentence. DeepL uses it to pick the right sense and doesn't bill it. */
  context?: string;
  source?: LanguageCode;
  target: LanguageCode;
}

export interface DeeplResult {
  translation: string;
  detectedSourceLang: LanguageCode | null;
}

/** A DeepL failure. `status` is DeepL's HTTP status, or 0 for timeouts and network errors. */
export class DeeplError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'DeeplError';
  }
}

interface DeeplResponse {
  translations?: { detected_source_language: string; text: string }[];
}

export async function deeplTranslate(
  input: DeeplInput,
  fetchImpl: typeof fetch = fetch,
): Promise<DeeplResult> {
  const { DEEPL_API_KEY, DEEPL_API_URL } = env();
  const body: Record<string, unknown> = {
    text: [input.text],
    target_lang: LANGUAGES[input.target].deepl.target,
  };
  if (input.source) body.source_lang = LANGUAGES[input.source].deepl.source;
  if (input.context && input.context !== input.text) body.context = input.context;

  const started = Date.now();
  let res: Response;
  try {
    res = await fetchImpl(`${DEEPL_API_URL}/v2/translate`, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError';
    throw new DeeplError(0, timedOut ? 'DeepL timed out' : 'DeepL request failed');
  }

  if (!res.ok) throw new DeeplError(res.status, `DeepL returned ${res.status}`);

  const data = (await res.json()) as DeeplResponse;
  const first = data.translations?.[0];
  if (!first) throw new DeeplError(res.status, 'DeepL returned no translation');

  // Cost check: DeepL bills by characters of `text` (not `context`).
  console.info(
    JSON.stringify({ event: 'deepl', chars: input.text.length, ms: Date.now() - started }),
  );
  return {
    translation: first.text,
    detectedSourceLang: fromDeeplSource(first.detected_source_language),
  };
}
