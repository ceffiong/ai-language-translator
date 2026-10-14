/** Longest selection we send for translation or explanation. */
export const MAX_SELECTION_LENGTH = 300;
/** Longest surrounding sentence we send as context. */
export const MAX_SENTENCE_LENGTH = 500;

/** Trims, collapses whitespace and strips wrapping quotes/punctuation from a selection. */
export function normalizeSelection(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s"'“”‘’«»()[\]]+|[\s"'“”‘’«»()[\],;:]+$/g, '')
    .slice(0, MAX_SELECTION_LENGTH);
}

/** Lowercased, accent-preserving key for de-duplicating cards and cache entries. */
export function normalizeKey(raw: string): string {
  return normalizeSelection(raw).toLocaleLowerCase();
}

// Abbreviations that end with a period but don't end a sentence (lowercase, no period).
const ABBREVIATIONS = new Set([
  // English
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'sr',
  'jr',
  'st',
  'vs',
  'etc',
  'e.g',
  'i.e',
  'inc',
  'ltd',
  'co',
  'approx',
  // Spanish
  'sra',
  'srta',
  'dra',
  'ud',
  'uds',
  'vd',
  'vds',
  'p.ej',
  'ej',
  'pág',
  'aprox',
  'núm',
  'av',
  'avda',
  'ee.uu',
  'cía',
  'dto',
]);

const TERMINATORS = new Set(['.', '!', '?', '…']);

function isSentenceEnd(text: string, i: number): boolean {
  const ch = text[i];
  if (ch === '\n') return true;
  if (ch === undefined || !TERMINATORS.has(ch)) return false;
  // Must be followed by whitespace (or closing quote then whitespace) or end of text.
  let j = i + 1;
  while (j < text.length && /["'”’»)]/.test(text[j]!)) j++;
  if (j < text.length && !/\s/.test(text[j]!)) return false;
  if (ch === '.') {
    // "Sr. García", "p. ej. esto": the word before the period is an abbreviation.
    const before = text
      .slice(0, i)
      .match(/(?:^|[\s(¿¡])([\p{L}.]+)$/u)?.[1]
      ?.toLowerCase();
    if (before && (ABBREVIATIONS.has(before) || /^\p{L}$/u.test(before))) return false;
  }
  return true;
}

/**
 * Returns the sentence that contains `text[start, end)`, which is the context we send
 * with a selection. Sentences break on . ! ? … followed by whitespace, and on newlines,
 * except after known abbreviations and single-letter initials.
 */
export function extractSentence(text: string, start: number, end: number = start): string {
  const s = Math.max(0, Math.min(start, text.length));
  const e = Math.max(s, Math.min(end, text.length));

  let from = 0;
  for (let i = s - 1; i >= 0; i--) {
    if (isSentenceEnd(text, i)) {
      from = i + 1;
      break;
    }
  }

  let to = text.length;
  for (let i = Math.max(e - 1, s); i < text.length; i++) {
    // A terminator inside the selection itself (e.g. selecting "Sr.") doesn't end it.
    if (i < e - 1) continue;
    if (isSentenceEnd(text, i)) {
      to = text[i] === '\n' ? i : i + 1;
      // Include trailing closing quotes.
      while (to < text.length && /["'”’»)]/.test(text[to]!)) to++;
      break;
    }
  }

  const sentence = text.slice(from, to).replace(/\s+/g, ' ').trim();
  if (sentence.length <= MAX_SENTENCE_LENGTH) return sentence;

  // Very long "sentence" (e.g. a list with no punctuation): window around the selection.
  const selStart = text.slice(from, s).replace(/\s+/g, ' ').trimStart().length;
  const half = Math.floor((MAX_SENTENCE_LENGTH - (e - s)) / 2);
  const winStart = Math.max(0, selStart - half);
  return sentence.slice(winStart, winStart + MAX_SENTENCE_LENGTH).trim();
}
