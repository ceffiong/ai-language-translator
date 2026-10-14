# AI Language Translator: Product & MVP Plan

_Validation MVP: AI language-learning browser extension, launching with Spanish ↔ English._

## Context
Market research (2026-10-13/14) found strong demand (about a $24B market, Duolingo at $1B+ revenue, Immersive Translate with 10M+ users). It also found the core idea is crowded: Rememberry, Toucan, Reverso, ReadLingo and Immersive Translate all do highlight → translate → save. Their 1–3★ reviews show where they fall short:
- free tiers taken away
- login and upgrade nags
- unreliable AI output
- crashes
- distrust of how data is handled
- missing learning depth, e.g. "needs usage examples to tell them apart", requests for IPA and saved history, "lacks detailed explanations"

**Decision:** no more desk research. Build a small MVP in 2–3 weeks to test the one open question: **will learners keep using an AI "nuance explainer" with spaced review, and pay for it?**
- Launch audience: Spanish ↔ English (English speakers learning Spanish, and Spanish speakers learning English). The product works for any language; the launch and marketing focus on this pair.
- Claude Code writes 100% of the code. The user has a technical background and left the stack to Claude.

## Product scope (MVP only)
**In:**
1. Select text on any page → a small floating button → popover showing:
   - DeepL translation, with the source language auto-detected
   - AI explanation (Gemini): meaning in this sentence, nuance and why this word, register, 2 example sentences, IPA
   - pronunciation through the browser's text-to-speech
2. **Save** → the card stores the word or phrase, the translation, the explanation, **the original sentence and the page URL**.
3. Web app: spaced-repetition review (FSRS algorithm) that works on a phone, plus a daily streak.
4. Free use without an account, capped at 30 explanations/day per install. An account is needed only to save and sync cards. **The free limits are set at launch and never cut back.**
5. An "Upgrade" button that is a fake door: it opens a "Pro is coming, $6/mo, join early access" page and logs the click. This measures willingness to pay without building billing.

**Out (until the success criteria are met):** letting users pick the AI model, etymology, payments, Anki export, a native mobile app, translating whole pages.

## Stack
| Part | Choice | Why |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo, TypeScript throughout | Shared types and validation between the extension and web app |
| Extension | **WXT** (Manifest V3 framework) + React | Hot reload, builds for both Chrome and Firefox from one codebase |
| Web app and API | **Next.js** (App Router), deployed on Vercel | Landing page and waitlist, auth, review dashboard and API routes in one app |
| Database | **MongoDB Atlas** (free M0 tier) through the official driver | User's preference; the document model fits cards well |
| Auth | **Better Auth** with its MongoDB adapter, plus Google sign-in and email magic link, plus its bearer plugin for the extension | Self-hosted, no per-user fees |
| Translation | DeepL API (detects the source language) | Best quality for Spanish ↔ English |
| Explanations | Gemini API (`gemini-flash-lite-latest` by default, set by `GEMINI_MODEL`), structured JSON output, streamed | Generous free tier for validation. Switched from Claude on 2026-10-14 |
| Spaced repetition | `ts-fsrs` | Modern, open-source scheduling algorithm |
| Analytics | PostHog (free tier) | Measures retention and the success criteria |
| Validation | zod | Shared request and response schemas |

## Repo layout (the folder is currently empty)
```
apps/extension/   WXT: entrypoints/content (selection button + popover in shadow DOM),
                  background (API calls, auth token), popup (sign in, daily usage, open dashboard)
apps/web/         Next.js: / (landing + waitlist), /review, /cards, /pro (fake door),
                  /extension/connect (passes the session to the extension),
                  api/translate, api/explain, api/cards, api/reviews
packages/shared/  zod schemas, types, explanation prompt + output schema, API client
```

## Key design details
- **API keys stay on the server.** The extension calls only `apps/web` API routes. Calls without an account are rate-limited by a random install ID, using MongoDB counters with a TTL index.
- **Explanation context:** the content script sends the selection plus its surrounding sentence (and nothing else from the page) to `/api/explain`. The prompt depends on the direction (Spanish → English or English → Spanish) and tells Claude to explain in the learner's native language.
- **Cache:** key = hash of (normalized selection, sentence, direction), stored in a Mongo collection. This cuts repeat cost and lets explanations be checked for quality.
- **Connecting the extension to an account:** `/extension/connect` signs the user in, then passes a Better Auth bearer token to the extension through `externally_connectable` messaging. The background script stores it in `chrome.storage.local`.
- **Permissions:** content script on `<all_urls>` (needed to catch selections) plus `storage`, nothing else. A plain-language privacy page says "only the text you select and its sentence leave your browser."
- **Collections:** `users` (Better Auth), `cards` {userId, text, translation, explanation, sentence, url, direction, fsrs state, due}, `reviewLogs`, `usage`, `explainCache`, `waitlist`.
- **Analytics events:** `explain_shown`, `card_saved`, `review_completed`, `streak_day`, `upgrade_clicked`, `pro_waitlist_joined`.

## Build order
1. Set up the monorepo and shared package. Next.js with the Mongo connection and Better Auth. Landing page with a waitlist.
2. `/api/translate` (DeepL) and `/api/explain` (streamed Gemini output), with zod validation, caching and rate limits.
3. WXT extension: selection button, popover with translation, explanation and text-to-speech, save button, connecting to an account.
4. Cards and FSRS: `/api/cards`, `/api/reviews`, `/review` page that works on a phone, streak.
5. PostHog events, `/pro` fake door, privacy page.
6. Deploy to Vercel and Atlas. Publish the extension as unlisted on the Chrome Web Store, and on Firefox Add-ons.

## Validation plan (after the build)
- Recruit 30–50 learners from r/Spanish, r/languagelearning, r/EnglishLearning and Spanish learning Discords.
- Have a bilingual reviewer check 50 cached explanations for accuracy.
- **Go/no-go after 3–4 weeks:** at least 25% of active users still reviewing on day 7, at least 10 people clicking the upgrade button or joining the Pro waitlist, and unprompted praise for the explanations. Miss these → stop or rethink.

## Verification
- **Unit tests (Vitest):** FSRS scheduling wrapper, zod schemas, rate limiter, cache keys, prompt output parsing using recorded model responses.
- **API tests:** route handlers with DeepL and Gemini mocked. One live smoke test, run behind an environment flag.
- **Extension end-to-end (Playwright with Chromium):** load the unpacked build, open a local Spanish test page, select text, check the popover renders, save, then check the card shows up in `/review`.
- **Manual check with Claude in Chrome:** select text on elpais.com and bbc.com, confirm the popover and text-to-speech work. Go through a full review session on a phone-sized viewport.
- **Cost check:** log tokens and DeepL characters per request, and confirm the cost per active user fits the budget.

## First step after approval: write the project docs
1. `ai-language-translator-plan.md` in the project root: this plan (market research summary, scope, stack, design, validation plan). Hosting is confirmed as Vercel: free Hobby plan during validation, Pro ($20/mo) once charging.
2. `IMPLEMENTATION_PLAN.md` in the project root: a detailed step-by-step build plan with a `- [ ]` checkbox for every task. It is grouped into phases (setup, backend APIs, extension, cards and FSRS, analytics and the fake upgrade button, deploy and publish, validation). Each phase lists its files, acceptance checks and test steps, and boxes get ticked as work is done.

No code until both files exist and the user says to start Phase 0.

## Needed from the user before building
API keys for DeepL and Gemini, a MongoDB Atlas account, a Vercel account, a PostHog project, Google OAuth credentials, and a Chrome Web Store developer account ($5 one-time fee). Claude will tell you when each is needed and will never enter them itself.

## Hosting decision
**Vercel**: free Hobby plan during private validation (Hobby is non-commercial only), then Pro ($20/mo) once charging. Netlify costs about the same, but its credit-based billing is harder to predict. Render's free tier sleeps when idle (30s+ cold starts), which is too slow for a popover. Hosting will stay a small cost; DeepL and Claude usage are the real costs, so caching matters.

---

## Appendix A: market research summary (2026-10-13)
- Online language learning market: about $21B (2025) → about $24B (2026), about 16% CAGR (Mordor Intelligence, via voxbooster).
- Duolingo: about $1.04B revenue in 2025 (84% subscriptions), about 12.5M paid subscribers in Q1 2026.
- Immersive Translate: claims 10M+ users, 2M+ on Edge, and Google "Best Chrome Extensions 2024". Shows that multi-engine AI translation in the browser can scale.
- Direct competitors: Rememberry (about 100K Chrome users), Toucan (raised a $4.5M seed; a listing reads "Toucan by Babbel"), ReadLingo ($3/mo), Memdora, Vocabulary Highlighter, Reverso, Readlang, LingQ (about $13/mo), Language Reactor, Yomitan (free, open source).
- Google is commoditizing basic translation: Chrome built-in Translator API (Chrome 138+), Google Translate Gemini "Practice" mode (Aug 2025).
- Extension economics: realistic free-to-paid conversion 0.5–2%, typical price $3–5/mo.
- DeepL API: about $25–27.50 per 1M characters plus a base fee (check deepl.com/pro). The API has no explanation, example or dictionary endpoint, so an LLM (Gemini) handles explanations.

## Appendix B: review mining (Firefox Add-ons, 1–3★, 2026-10-14)
Reviews read for Immersive Translate (155), Reverso (70) and Yomitan (9). Reddit and the Chrome Web Store could not be reached by automated tools; to fill the gap, paste threads in manually.
1. **Free tier taken away**, the top cause of 1★ reviews (Immersive Translate removed free Google and Bing engines, added a daily cap, required login, and users moved to KISS Translator).
2. **Login and upgrade nagging**: banners that can't be closed, sign-up prompts after signing up.
3. **Unreliable AI output**: wrong target language, text cut off.
4. **Stability**: crashes, memory leaks, a popup on every browser start.
5. **Trust and privacy**: data collection, censorship.
6. **Unmet learning needs**: usage examples for near-synonyms, IPA, saved history, detailed explanations for advanced learners.

**Product principles that follow:** never take features away from free users; no login for basic use; charge for depth, not basic translation; minimal permissions and a clear privacy policy; reliability first.

### Sources
- https://voxbooster.com/blog/language-learning-statistics-2026
- https://www.statista.com/statistics/1247833/annual-duolingo-revenue/
- https://immersivetranslate.com/home/
- https://chromeboard.com/extension/rememberry-translate-and-dipiagiiohfljcicegpgffpbnjmgjcnf
- https://www.builtinla.com/articles/toucan-raises-4m-seed-round-language-learning-browser-extension
- https://developer.chrome.com/docs/ai/translator-api
- https://www.tomsguide.com/ai/google-gemini/google-translate-just-got-a-huge-upgrade-live-conversations-and-language-practice-are-here
- https://simplelocalize.io/blog/posts/ai-machine-translation-cost-comparison/
- https://dev.to/_350df62777eb55e1/real-numbers-freemium-chrome-extension-monetization-after-6-months-5hga
- https://addons.mozilla.org/api/v5/ratings/rating/?addon=immersive-translate&score=1,2,3
- https://makerkit.dev/pricing-calculator/vercel-vs-netlify
