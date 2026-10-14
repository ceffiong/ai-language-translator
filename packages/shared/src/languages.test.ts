import { describe, expect, it } from 'vitest';
import { directionKey, fromDeeplSource, parseDirectionKey, resolveDirection } from './languages';

describe('languages', () => {
  it('round-trips direction keys', () => {
    expect(directionKey({ source: 'es', target: 'en' })).toBe('es->en');
    expect(parseDirectionKey('en->es')).toEqual({ source: 'en', target: 'es' });
  });

  it('rejects invalid direction keys', () => {
    expect(parseDirectionKey('es->es')).toBeNull();
    expect(parseDirectionKey('fr->en')).toBeNull();
    expect(parseDirectionKey('nonsense')).toBeNull();
  });

  it('maps DeepL source codes', () => {
    expect(fromDeeplSource('ES')).toBe('es');
    expect(fromDeeplSource('EN-US')).toBe('en');
    expect(fromDeeplSource('FR')).toBeNull();
  });

  it('resolves direction from detected language and learner settings', () => {
    const englishSpeaker = { native: 'en', learning: 'es' } as const;
    expect(resolveDirection('es', englishSpeaker)).toEqual({ source: 'es', target: 'en' });
    expect(resolveDirection('en', englishSpeaker)).toEqual({ source: 'en', target: 'es' });

    const spanishSpeaker = { native: 'es', learning: 'en' } as const;
    expect(resolveDirection('en', spanishSpeaker)).toEqual({ source: 'en', target: 'es' });
    expect(resolveDirection('es', spanishSpeaker)).toEqual({ source: 'es', target: 'en' });
  });

  it('treats an unsupported detected language as the language being learned', () => {
    // DeepL detects short Spanish phrases such as "me da igual" as Portuguese.
    const englishSpeaker = { native: 'en', learning: 'es' } as const;
    expect(resolveDirection(fromDeeplSource('PT'), englishSpeaker)).toEqual({
      source: 'es',
      target: 'en',
    });
  });
});
