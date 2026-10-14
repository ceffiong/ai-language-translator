import { z } from 'zod';
import { LANGUAGE_CODES, type LanguageCode } from './languages';
import { MAX_SELECTION_LENGTH, MAX_SENTENCE_LENGTH } from './text';

export const LanguageCodeSchema = z.enum(LANGUAGE_CODES as [LanguageCode, ...LanguageCode[]]);

const selection = z.string().trim().min(1).max(MAX_SELECTION_LENGTH);
const sentence = z.string().trim().max(MAX_SENTENCE_LENGTH);

// --- Errors ----------------------------------------------------------------

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      'bad_request',
      'unauthorized',
      'forbidden',
      'quota_exceeded',
      'rate_limited',
      'upstream_error',
      'internal',
    ]),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// --- Translate -------------------------------------------------------------

export const TranslateRequestSchema = z.object({
  text: selection,
  sentence: sentence.optional(),
  targetLang: LanguageCodeSchema,
  sourceLang: LanguageCodeSchema.optional(),
});
export type TranslateRequest = z.infer<typeof TranslateRequestSchema>;

export const TranslateResponseSchema = z.object({
  translation: z.string(),
  detectedSourceLang: LanguageCodeSchema.nullable(),
  cached: z.boolean(),
});
export type TranslateResponse = z.infer<typeof TranslateResponseSchema>;

// --- Explain ---------------------------------------------------------------

export const ExplainRequestSchema = z
  .object({
    text: selection,
    sentence,
    sourceLang: LanguageCodeSchema,
    /** The learner's native language, which the explanation is written in. */
    targetLang: LanguageCodeSchema,
  })
  .refine((r) => r.sourceLang !== r.targetLang, {
    message: 'sourceLang and targetLang must differ.',
    path: ['targetLang'],
  });
export type ExplainRequest = z.infer<typeof ExplainRequestSchema>;

export const RegisterSchema = z.enum(['formal', 'neutral', 'informal', 'slang', 'vulgar']);

export const ExampleSchema = z.object({
  source: z.string().min(1),
  translation: z.string().min(1),
});

/** What the model returns for a selection. Written in the learner's native language. */
export const ExplanationSchema = z.object({
  meaningInContext: z.string().min(1),
  nuance: z.string().min(1),
  register: RegisterSchema,
  grammarNote: z.string().nullable(),
  examples: z.array(ExampleSchema).min(1).max(3),
  ipa: z.string().nullable(),
  partOfSpeech: z.string().nullable(),
  lemma: z.string().nullable(),
});
export type Explanation = z.infer<typeof ExplanationSchema>;

/**
 * `/api/explain` streams newline-delimited JSON, one event per line:
 * `delta` events carry raw JSON text as the model writes it (for progressive display),
 * `reset` means a retry started and earlier deltas should be discarded,
 * and the stream always ends with exactly one `done` or `error` event.
 */
export const ExplainStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({ type: z.literal('reset') }),
  z.object({ type: z.literal('done'), explanation: ExplanationSchema, cached: z.boolean() }),
  z.object({ type: z.literal('error'), error: ApiErrorSchema.shape.error }),
]);
export type ExplainStreamEvent = z.infer<typeof ExplainStreamEventSchema>;

// --- Usage -----------------------------------------------------------------

export const UsageResponseSchema = z.object({
  explanations: z.object({ limit: z.number().int(), remaining: z.number().int() }),
});
export type UsageResponse = z.infer<typeof UsageResponseSchema>;

// --- Cards & reviews -------------------------------------------------------

export const CardContextSchema = z.object({
  sentence,
  url: z.url().max(2048).optional(),
  pageTitle: z.string().max(300).optional(),
});
export type CardContext = z.infer<typeof CardContextSchema>;

export const SaveCardRequestSchema = z.object({
  text: selection,
  translation: z.string().min(1).max(1000),
  explanation: ExplanationSchema.nullable(),
  sourceLang: LanguageCodeSchema,
  targetLang: LanguageCodeSchema,
  context: CardContextSchema,
});
export type SaveCardRequest = z.infer<typeof SaveCardRequestSchema>;

export const RatingSchema = z.enum(['again', 'hard', 'good', 'easy']);
export type Rating = z.infer<typeof RatingSchema>;

export const ReviewRequestSchema = z.object({
  cardId: z.string().min(1),
  rating: RatingSchema,
});
export type ReviewRequest = z.infer<typeof ReviewRequestSchema>;

// --- Waitlist --------------------------------------------------------------

export const WaitlistRequestSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  source: z.enum(['landing', 'pro']).default('landing'),
  note: z.string().trim().max(1000).optional(),
});
export type WaitlistRequest = z.infer<typeof WaitlistRequestSchema>;
