import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  buildExplainPrompt,
  ExplanationSchema,
  parseExplanation,
  type ExplainRequest,
  type Explanation,
} from '@ai-translator/shared';
import { env } from './env';

export const EXPLAIN_MODEL = 'claude-haiku-5-5';
/** A full explanation is about 300–500 tokens; this caps cost if something goes wrong. */
const MAX_TOKENS = 1024;

let client: Anthropic | undefined;

function anthropic(): Anthropic {
  // The route retries once itself, so the SDK doesn't, keeping worst-case latency bounded.
  client ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY, maxRetries: 0, timeout: 20_000 });
  return client;
}

export interface ExplanationResult {
  /** Null if the output wasn't valid JSON matching the schema. */
  explanation: Explanation | null;
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * Asks Claude to explain a selection, calling `onText` with each chunk of JSON as it
 * streams. Throws on API errors; returns `explanation: null` for invalid output.
 */
export async function generateExplanation(
  req: ExplainRequest,
  onText: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<ExplanationResult> {
  const { system, user } = buildExplainPrompt(req);
  const started = Date.now();
  let firstTokenMs: number | null = null;

  const stream = anthropic().messages.stream(
    {
      model: EXPLAIN_MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { format: zodOutputFormat(ExplanationSchema), effort: 'low' },
    },
    { signal },
  );
  stream.on('text', (chunk) => {
    firstTokenMs ??= Date.now() - started;
    onText(chunk);
  });

  const message = await stream.finalMessage();
  const raw = message.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
  const usage = {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
  console.info(
    JSON.stringify({
      event: 'claude_explain',
      model: EXPLAIN_MODEL,
      ...usage,
      stopReason: message.stop_reason,
      firstTokenMs,
      ms: Date.now() - started,
    }),
  );
  return { explanation: parseExplanation(raw), usage };
}
