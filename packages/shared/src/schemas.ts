import { z } from 'zod';
import { LANGUAGE_CODES, type LanguageCode } from './languages';
import { MAX_SELECTION_LENGTH, MAX_SENTENCE_LENGTH } from './text';

export const LanguageCodeSchema = z.enum(LANGUAGE_CODES as [LanguageCode, ...LanguageCode[]]);

const selection = z.string().trim().min(1).max(MAX_SELECTION_LENGTH);
const sentence = z.string().trim().max(MAX_SENTENCE_LENGTH);

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

export const ExplainRequestSchema = z.object({
  text: selection,
  sentence,
  sourceLang: LanguageCodeSchema,
  /** The learner's native language, which the explanation is written in. */
  targetLang: LanguageCodeSchema,
});
export type ExplainRequest = z.infer<typeof ExplainRequestSchema>;

export const RegisterSchema = z.enum(['formal', 'neutral', 'informal', 'slang', 'vulgar']);

export const ExampleSchema = z.object({
  source: z.string().min(1),
  translation: z.string().min(1),
});

/** What Claude returns for a selection. Written in the learner's native language. */
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

// --- Errors ----------------------------------------------------------------

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      'bad_request',
      'unauthorized',
      'quota_exceeded',
      'rate_limited',
      'upstream_error',
      'internal',
    ]),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
