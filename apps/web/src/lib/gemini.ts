import 'server-only';
import { ApiError, GoogleGenAI, ThinkingLevel } from '@google/genai';
import { z } from 'zod';
import {
  buildExplainPrompt,
  ExplanationSchema,
  parseExplanation,
  type ExplainRequest,
  type Explanation,
} from '@ai-translator/shared';
import { env } from './env';

/** A full explanation is about 300–500 tokens; this caps cost if something goes wrong. */
const MAX_OUTPUT_TOKENS = 1024;
const TIMEOUT_MS = 20_000;

/** The Explanation schema as JSON Schema, which Gemini's structured output follows. */
const RESPONSE_SCHEMA = (() => {
  const schema: Record<string, unknown> = z.toJSONSchema(ExplanationSchema);
  delete schema.$schema;
  return schema;
})();

const THINKING_LEVELS = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
} as const;

let client: GoogleGenAI | undefined;

function gemini(): GoogleGenAI {
  client ??= new GoogleGenAI({
    apiKey: env().GEMINI_API_KEY,
    httpOptions: { timeout: TIMEOUT_MS },
  });
  return client;
}

/** The model explanations come from. */
export function explainModel(): string {
  return env().GEMINI_MODEL;
}

/** Identifies the model and its settings, so cached answers aren't reused across them. */
export function explainVariant(): string {
  return `${env().GEMINI_MODEL}/${env().GEMINI_THINKING}`;
}

export interface ExplanationResult {
  /** Null if the output wasn't valid JSON matching the schema. */
  explanation: Explanation | null;
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * Asks Gemini to explain a selection, calling `onText` with each chunk of JSON as it
 * streams. Throws on API errors; returns `explanation: null` for invalid output.
 */
export async function generateExplanation(
  req: ExplainRequest,
  onText: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<ExplanationResult> {
  const { system, user } = buildExplainPrompt(req);
  const model = explainModel();
  const started = Date.now();
  let firstTokenMs: number | null = null;

  const stream = await gemini().models.generateContentStream({
    model,
    contents: user,
    config: {
      systemInstruction: system,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: 'application/json',
      responseJsonSchema: RESPONSE_SCHEMA,
      thinkingConfig: { thinkingLevel: THINKING_LEVELS[env().GEMINI_THINKING] },
      abortSignal: signal,
    },
  });

  let raw = '';
  let usage = { inputTokens: 0, outputTokens: 0 };
  let finishReason: string | undefined;
  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) {
      firstTokenMs ??= Date.now() - started;
      raw += text;
      onText(text);
    }
    if (chunk.usageMetadata) {
      usage = {
        inputTokens: chunk.usageMetadata.promptTokenCount ?? 0,
        outputTokens: chunk.usageMetadata.candidatesTokenCount ?? 0,
      };
    }
    finishReason = chunk.candidates?.[0]?.finishReason ?? finishReason;
  }

  console.info(
    JSON.stringify({
      event: 'llm_explain',
      model,
      thinking: env().GEMINI_THINKING,
      ...usage,
      finishReason,
      firstTokenMs,
      ms: Date.now() - started,
    }),
  );
  return { explanation: parseExplanation(raw), usage };
}

/**
 * Whether a failed call is worth retrying straight away. Timeouts and server errors
 * might clear; bad requests, auth errors and rate limits (429) won't within a second.
 */
export function isRetryable(err: unknown): boolean {
  if (!(err instanceof ApiError)) return true;
  return err.status === 408 || err.status >= 500;
}

/** HTTP status of a failed call, for logging. */
export function errorStatus(err: unknown): number | undefined {
  return err instanceof ApiError ? err.status : undefined;
}
