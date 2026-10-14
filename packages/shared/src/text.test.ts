import { describe, expect, it } from 'vitest';
import {
  extractSentence,
  MAX_SELECTION_LENGTH,
  MAX_SENTENCE_LENGTH,
  normalizeKey,
  normalizeSelection,
} from './text';

/** Helper: extract the sentence around the first occurrence of `needle`. */
function around(text: string, needle: string): string {
  const i = text.indexOf(needle);
  if (i < 0) throw new Error(`needle not found: ${needle}`);
  return extractSentence(text, i, i + needle.length);
}

describe('normalizeSelection', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeSelection('  echar   de\n menos  ')).toBe('echar de menos');
  });

  it('strips wrapping quotes and trailing punctuation', () => {
    expect(normalizeSelection('«ojalá»,')).toBe('ojalá');
    expect(normalizeSelection('"break down";')).toBe('break down');
  });

  it('keeps inner punctuation and accents', () => {
    expect(normalizeSelection('¿Qué tal?')).toBe('¿Qué tal?');
  });

  it('caps the length', () => {
    expect(normalizeSelection('a'.repeat(1000))).toHaveLength(MAX_SELECTION_LENGTH);
  });

  it('normalizeKey lowercases but keeps accents', () => {
    expect(normalizeKey(' Échale  ')).toBe('échale');
  });
});

describe('extractSentence', () => {
  it('returns the sentence containing the selection', () => {
    const text = 'Hace frío. Echo de menos a mi familia. Mañana vuelvo.';
    expect(around(text, 'de menos')).toBe('Echo de menos a mi familia.');
  });

  it('handles the first and last sentence', () => {
    const text = 'Primera frase aquí. Última frase';
    expect(around(text, 'Primera')).toBe('Primera frase aquí.');
    expect(around(text, 'Última')).toBe('Última frase');
  });

  it('handles Spanish inverted punctuation', () => {
    const text = 'Llegué tarde. ¿Sabes dónde está la estación? ¡Qué lío! Gracias.';
    expect(around(text, 'dónde')).toBe('¿Sabes dónde está la estación?');
    expect(around(text, 'lío')).toBe('¡Qué lío!');
  });

  it('does not split on abbreviations', () => {
    const text = 'Lo dijo ayer. El Sr. García habló con la Dra. López sobre el tema. Fin.';
    expect(around(text, 'habló')).toBe('El Sr. García habló con la Dra. López sobre el tema.');
  });

  it('does not split on English abbreviations or initials', () => {
    const text = 'Intro. Mr. Smith met J. K. Rowling, e.g. at lunch. The end.';
    expect(around(text, 'met')).toBe('Mr. Smith met J. K. Rowling, e.g. at lunch.');
  });

  it('does not split on decimals or periods inside words', () => {
    const text = 'Cuesta 3.50 euros en www.ejemplo.com hoy. Otra.';
    expect(around(text, 'euros')).toBe('Cuesta 3.50 euros en www.ejemplo.com hoy.');
  });

  it('ends a sentence after Spanish "no."', () => {
    const text = 'Le pregunté y dijo que no. Luego se fue a casa.';
    expect(around(text, 'Luego')).toBe('Luego se fue a casa.');
  });

  it('treats line breaks as sentence boundaries', () => {
    const text = 'Titular sin punto\nEl párrafo empieza aquí y sigue. Más texto.';
    expect(around(text, 'Titular')).toBe('Titular sin punto');
    expect(around(text, 'párrafo')).toBe('El párrafo empieza aquí y sigue.');
  });

  it('includes closing quotes', () => {
    const text = 'Ella dijo: «No me da la gana.» Y se fue.';
    expect(around(text, 'gana')).toBe('Ella dijo: «No me da la gana.»');
  });

  it('works when the selection spans a sentence boundary', () => {
    const text = 'Uno dos. Tres cuatro. Cinco.';
    const start = text.indexOf('dos');
    const end = text.indexOf('Tres') + 4;
    expect(extractSentence(text, start, end)).toBe('Uno dos. Tres cuatro.');
  });

  it('clamps out-of-range offsets', () => {
    expect(extractSentence('Hola mundo.', -5, 999)).toBe('Hola mundo.');
  });

  it('windows very long sentences around the selection', () => {
    const filler = 'palabra '.repeat(200);
    const text = `${filler}OBJETIVO ${filler}`;
    const result = around(text, 'OBJETIVO');
    expect(result.length).toBeLessThanOrEqual(MAX_SENTENCE_LENGTH);
    expect(result).toContain('OBJETIVO');
  });
});
