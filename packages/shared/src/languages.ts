/**
 * Languages the product supports. The MVP launches with Spanish ↔ English, but the
 * code is language-agnostic: adding a language means adding it here.
 */
export const LANGUAGES = {
  en: {
    name: 'English',
    nativeName: 'English',
    deepl: { source: 'EN', target: 'EN-US' },
    tts: 'en-US',
  },
  es: {
    name: 'Spanish',
    nativeName: 'Español',
    deepl: { source: 'ES', target: 'ES' },
    tts: 'es-ES',
  },
} as const;

export type LanguageCode = keyof typeof LANGUAGES;

export const LANGUAGE_CODES = Object.keys(LANGUAGES) as LanguageCode[];

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && value in LANGUAGES;
}

/** A translation direction, e.g. Spanish text explained for an English speaker. */
export interface Direction {
  source: LanguageCode;
  target: LanguageCode;
}

/** Stable string key for a direction, e.g. `es->en`. Used in cache keys and card dedupe. */
export type DirectionKey = `${LanguageCode}->${LanguageCode}`;

export function directionKey({ source, target }: Direction): DirectionKey {
  return `${source}->${target}`;
}

export function parseDirectionKey(key: string): Direction | null {
  const [source, target] = key.split('->');
  if (!isLanguageCode(source) || !isLanguageCode(target) || source === target) return null;
  return { source, target };
}

/** Maps a DeepL detected-source code (e.g. "ES", "EN") back to our language code. */
export function fromDeeplSource(code: string): LanguageCode | null {
  const lower = code.toLowerCase().split('-')[0];
  return isLanguageCode(lower) ? lower : null;
}

/**
 * Picks the direction for a selection: text in the language being learned is explained
 * in the native language, and text in the native language is translated into the
 * language being learned.
 *
 * `detected` is null when DeepL reports a language we don't support. That is almost
 * always the language being learned mislabelled (DeepL calls short Spanish phrases like
 * "me da igual" Portuguese), so it's treated as the learning language.
 */
export function resolveDirection(
  detected: LanguageCode | null,
  settings: { native: LanguageCode; learning: LanguageCode },
): Direction {
  if (detected === settings.native) return { source: settings.native, target: settings.learning };
  return { source: settings.learning, target: settings.native };
}
