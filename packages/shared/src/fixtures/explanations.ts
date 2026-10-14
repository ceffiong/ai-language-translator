/** Raw Claude outputs, used to test the parser. Replaced with recorded responses below. */
export const RECORDED_EXPLANATIONS: { name: string; raw: string }[] = [
  {
    name: 'placeholder',
    raw: JSON.stringify({
      meaningInContext: 'I miss (my sister).',
      nuance: 'Spain uses "echar de menos"; Latin America prefers "extrañar".',
      register: 'neutral',
      grammarNote: null,
      examples: [{ source: 'Te echo de menos.', translation: 'I miss you.' }],
      ipa: '/ˈe.tʃo ðe ˈme.nos/',
      partOfSpeech: 'verb phrase',
      lemma: 'echar de menos',
    }),
  },
];
