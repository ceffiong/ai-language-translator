import { describe, expect, it, vi } from 'vitest';
import { testEnv } from '../../test/fakes';

vi.mock('./env', () => ({ env: () => testEnv() }));

const { deeplTranslate, DeeplError } = await import('./deepl');

function fakeFetch(response: Response | (() => never)) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return typeof response === 'function' ? response() : response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const ok = () =>
  Response.json({ translations: [{ detected_source_language: 'ES', text: 'I miss' }] });

describe('deeplTranslate', () => {
  it('sends the text, DeepL language codes and the sentence as context', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { impl, calls } = fakeFetch(ok());
    const result = await deeplTranslate(
      { text: 'echo de menos', context: 'Echo de menos a mi hermana.', source: 'es', target: 'en' },
      impl,
    );
    expect(result).toEqual({ translation: 'I miss', detectedSourceLang: 'es' });
    expect(calls[0]!.url).toBe('https://api-free.deepl.com/v2/translate');
    expect(new Headers(calls[0]!.init.headers).get('authorization')).toBe(
      'DeepL-Auth-Key test-deepl-key:fx',
    );
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      text: ['echo de menos'],
      target_lang: 'EN-US',
      source_lang: 'ES',
      context: 'Echo de menos a mi hermana.',
    });
  });

  it('lets DeepL detect the source language when none is given', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { impl, calls } = fakeFetch(ok());
    await deeplTranslate({ text: 'hola', target: 'en' }, impl);
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.source_lang).toBeUndefined();
    expect(body.context).toBeUndefined();
  });

  it('returns null for an unsupported detected language', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { impl } = fakeFetch(
      Response.json({ translations: [{ detected_source_language: 'FR', text: 'hello' }] }),
    );
    expect(
      (await deeplTranslate({ text: 'bonjour', target: 'en' }, impl)).detectedSourceLang,
    ).toBeNull();
  });

  it('throws a DeeplError with the status on HTTP errors', async () => {
    const { impl } = fakeFetch(new Response('Too many requests', { status: 429 }));
    const err = await deeplTranslate({ text: 'hola', target: 'en' }, impl).catch((e) => e);
    expect(err).toBeInstanceOf(DeeplError);
    expect(err.status).toBe(429);
  });

  it('throws a DeeplError with status 0 on timeouts, without leaking the key', async () => {
    const { impl } = fakeFetch(() => {
      throw new DOMException('timed out', 'TimeoutError');
    });
    const err = await deeplTranslate({ text: 'hola', target: 'en' }, impl).catch((e) => e);
    expect(err.status).toBe(0);
    expect(err.message).toBe('DeepL timed out');
    expect(err.message).not.toContain('test-deepl-key');
  });
});
