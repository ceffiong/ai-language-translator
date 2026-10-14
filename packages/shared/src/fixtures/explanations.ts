/**
 * Real model outputs (gemini-flash-lite-latest, prompt explain-v2, 2026-10-14), used to
 * test the parser. Kept verbatim, including their imperfections.
 */
export const RECORDED_EXPLANATIONS: { name: string; raw: string }[] = [
  {
    name: 'es->en echo de menos',
    raw: '{"meaningInContext": "I miss my sister. This is a common set phrase used to express longing or sadness because someone or something is absent.", "nuance": "Speakers use \\"echar de menos\\" to express missing someone affectionately. You might confuse it with \\"extrañar\\", which has a very similar meaning and is often interchangeable, though \\"echar de menos\\" is slightly more common in Spain while \\"extrañar\\" is widespread in Latin America.", "register": "neutral", "grammarNote": "This phrase uses a reflexive pronoun pattern with a preposition, functioning similarly to \\"gustar\\" where the direct object of the English sentence becomes the thing being missed.", "examples": [{"source": "Echo de menos las tardes de verano en la playa.", "translation": "I miss the summer afternoons at the beach."}, {"source": "¿Me echas de menos cuando viajo?", "translation": "Do you miss me when I travel?"}], "ipa": "/ˈetʃo ðe ˈmenos/", "partOfSpeech": "verb phrase", "lemma": "echar de menos"}',
  },
  {
    name: 'es->en tengas',
    raw: '{"meaningInContext": "It means \\"you have\\" in this context, used here to form a wish for someone\'s trip.", "nuance": "The subjunctive mood is required after expressions of hope like \\"espero que\\". You might confuse it with the indicative form \\"tienes\\", but \\"tienes\\" states a fact rather than expressing a desire.", "register": "neutral", "grammarNote": "This is the present subjunctive form of \\"tener\\" for the singular \\"tú\\" pronoun, triggered by the wish expressed in the main clause.", "examples": [{"source": "Espero que tengas suerte en el examen.", "translation": "I hope you have good luck on the exam."}, {"source": "Quiero que tengas toda la información.", "translation": "I want you to have all the information."}], "ipa": "/ˈteŋ.ɡas/", "partOfSpeech": "verb", "lemma": "tener"}',
  },
  {
    name: 'en->es put up with',
    raw: '{"meaningInContext": "Significa tolerar o soportar algo o a alguien desagradable sin protestar.", "nuance": "Se elige para hablar de situaciones molestas que se aguantan con paciencia. Se puede comparar con \'tolerate\' (más formal) o \'stand\' (muy similar en uso cotidiano).", "register": "informal", "grammarNote": "Es un verbo frasal inseparable, lo que significa que el objeto directo o pronombre siempre va al final, después de la partícula \'with\'.", "examples": [{"source": "I cannot put up with his bad attitude anymore.", "translation": "No soporto más su mal carácter."}, {"source": "How do you put up with this cold weather?", "translation": "¿Cómo aguantas este clima frío?"}], "ipa": "/ˈpʊt ˈʌp wɪð/", "partOfSpeech": "verbo frasal", "lemma": "put up with"}',
  },
];
