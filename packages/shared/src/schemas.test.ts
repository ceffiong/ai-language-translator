import { describe, expect, it } from 'vitest';
import {
  ExplanationSchema,
  ExplainRequestSchema,
  TranslateRequestSchema,
  WaitlistRequestSchema,
} from './schemas';

describe('schemas', () => {
  it('accepts a valid translate request and trims text', () => {
    const r = TranslateRequestSchema.parse({ text: '  ojalá ', targetLang: 'en' });
    expect(r.text).toBe('ojalá');
  });

  it('rejects unsupported languages and empty text', () => {
    expect(TranslateRequestSchema.safeParse({ text: 'hola', targetLang: 'fr' }).success).toBe(
      false,
    );
    expect(TranslateRequestSchema.safeParse({ text: '   ', targetLang: 'en' }).success).toBe(false);
  });

  it('requires a sentence for explanations', () => {
    expect(
      ExplainRequestSchema.safeParse({ text: 'ojalá', sourceLang: 'es', targetLang: 'en' }).success,
    ).toBe(false);
  });

  it('validates an explanation', () => {
    const ok = ExplanationSchema.safeParse({
      meaningInContext: 'I miss',
      nuance:
        '"Echar de menos" is the usual way to say "to miss" in Spain; "extrañar" is more common in Latin America.',
      register: 'neutral',
      grammarNote: null,
      examples: [{ source: 'Te echo de menos.', translation: 'I miss you.' }],
      ipa: '/eˈtʃaɾ ðe ˈmenos/',
      partOfSpeech: 'verb phrase',
      lemma: 'echar de menos',
    });
    expect(ok.success).toBe(true);
  });

  it('rejects an explanation with no examples', () => {
    const bad = ExplanationSchema.safeParse({
      meaningInContext: 'x',
      nuance: 'y',
      register: 'neutral',
      grammarNote: null,
      examples: [],
      ipa: null,
      partOfSpeech: null,
      lemma: null,
    });
    expect(bad.success).toBe(false);
  });

  it('normalizes waitlist emails', () => {
    const r = WaitlistRequestSchema.parse({ email: '  Test@Example.COM ' });
    expect(r).toEqual({ email: 'test@example.com', source: 'landing' });
    expect(WaitlistRequestSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });
});
