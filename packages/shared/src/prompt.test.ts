import { describe, expect, it } from 'vitest';
import { buildExplainPrompt, parseExplanation, PROMPT_VERSION } from './prompt';
import { RECORDED_EXPLANATIONS } from './fixtures/explanations';

describe('buildExplainPrompt', () => {
  it('builds the es→en prompt', () => {
    const prompt = buildExplainPrompt({
      text: '  echo de menos ',
      sentence: 'Desde que se fue,   echo de menos a mi hermana.',
      sourceLang: 'es',
      targetLang: 'en',
    });
    expect(prompt).toMatchSnapshot();
  });

  it('builds the en→es prompt, explaining in Spanish', () => {
    const prompt = buildExplainPrompt({
      text: 'put up with',
      sentence: "I can't put up with the noise any more.",
      sourceLang: 'en',
      targetLang: 'es',
    });
    expect(prompt.system).toContain('You are a precise, friendly English tutor');
    expect(prompt.system).toContain('Write every explanation field in Spanish');
    expect(prompt.user).toBe(
      `Sentence: "I can't put up with the noise any more."\nSelection: "put up with"`,
    );
  });

  it('handles a missing sentence', () => {
    const prompt = buildExplainPrompt({
      text: 'madrugar',
      sentence: '',
      sourceLang: 'es',
      targetLang: 'en',
    });
    expect(prompt.user).toBe('Sentence: (none)\nSelection: "madrugar"');
  });

  it('has a prompt version for cache keys', () => {
    expect(PROMPT_VERSION).toMatch(/^explain-v\d+$/);
  });
});

describe('parseExplanation', () => {
  it.each(RECORDED_EXPLANATIONS)('accepts the recorded response for "$name"', ({ raw }) => {
    const parsed = parseExplanation(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.examples.length).toBeGreaterThan(0);
  });

  it('tolerates a markdown code fence', () => {
    const raw = '```json\n' + RECORDED_EXPLANATIONS[0]!.raw + '\n```';
    expect(parseExplanation(raw)).not.toBeNull();
  });

  it('rejects truncated JSON', () => {
    const raw = RECORDED_EXPLANATIONS[0]!.raw;
    expect(parseExplanation(raw.slice(0, raw.length / 2))).toBeNull();
  });

  it('rejects JSON missing required fields', () => {
    expect(parseExplanation('{"meaningInContext":"x"}')).toBeNull();
  });

  it('rejects an unknown register', () => {
    const json = JSON.parse(RECORDED_EXPLANATIONS[0]!.raw);
    expect(parseExplanation(JSON.stringify({ ...json, register: 'posh' }))).toBeNull();
  });

  it('rejects plain prose', () => {
    expect(parseExplanation('Sorry, I cannot help with that.')).toBeNull();
  });
});
