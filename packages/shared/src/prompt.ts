import { LANGUAGES } from './languages';
import { ExplanationSchema, type ExplainRequest, type Explanation } from './schemas';
import { normalizeSelection } from './text';

/**
 * Bump whenever the prompt or the Explanation schema changes. It is part of the cache
 * key, so a new version stops old cached explanations from being served.
 */
export const PROMPT_VERSION = 'explain-v1';

export interface ExplainPrompt {
  system: string;
  user: string;
}

/** Builds the system and user prompts for explaining a selection to a learner. */
export function buildExplainPrompt(req: ExplainRequest): ExplainPrompt {
  const source = LANGUAGES[req.sourceLang].name;
  const native = LANGUAGES[req.targetLang].name;
  const text = normalizeSelection(req.text);
  const sentence = req.sentence.replace(/\s+/g, ' ').trim();

  const system = `You are a precise, friendly ${source} tutor. A learner whose native language is ${native} selected some ${source} text while reading and wants to understand it.

Write every explanation field in ${native}, because that is the language the learner reads best. Quote ${source} words in their original form.

Fields:
- meaningInContext: what the selection means in this exact sentence, in one or two short sentences. If it is an idiom or set phrase, say so and give its overall meaning rather than a word-by-word gloss.
- nuance: why a speaker would choose this word or phrase here. Name one or two near-synonyms the learner might confuse it with and say briefly how they differ. Keep it under 60 words.
- register: formal, neutral, informal, slang or vulgar, as used in this sentence.
- grammarNote: one short note only when grammar is the key to understanding (for example ser vs estar, por vs para, the subjunctive, a phrasal verb, a reflexive or pronominal verb, a conjugated form); otherwise null.
- examples: exactly 2 new, natural example sentences in ${source} that use the selection with the same meaning, each with a ${native} translation. Keep them short and everyday.
- ipa: the IPA transcription of the selection as a whole, in a standard accent, between slashes. Use null if the selection is longer than about six words.
- partOfSpeech: in ${native}, e.g. "verb" or "noun phrase"; null for full sentences.
- lemma: the dictionary form if the selection is an inflected single word or verb phrase (e.g. "echaba de menos" → "echar de menos"); otherwise null.

Rules:
- Be accurate above all. If the meaning is ambiguous, give the most likely reading in this sentence and say it is ambiguous.
- Never invent etymology, statistics, regional claims or sources.
- If the selection is not actually ${source}, or is a name, number or typo, say so plainly in meaningInContext and keep the other fields minimal.
- Be concise: the learner reads this in a small popup.`;

  const user = `Sentence: ${sentence ? `"${sentence}"` : '(none)'}
Selection: "${text}"`;

  return { system, user };
}

/**
 * Parses the model's raw output into an Explanation. Returns null if it is not valid JSON
 * or does not match the schema, so the caller can retry.
 */
export function parseExplanation(raw: string): Explanation | null {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch {
    return null;
  }
  const parsed = ExplanationSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}
