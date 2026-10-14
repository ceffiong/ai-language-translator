# Implementation Plan: AI Language Translator MVP

Companion to [`ai-language-translator-plan.md`](./ai-language-translator-plan.md), which covers the why, scope and stack.
Tick each box (`- [x]`) when the task is done **and** its check passes. Don't start a phase until the previous phase's **Exit criteria** are all ticked.

**Legend:** 🧑 = needs the user (account, key or decision) · 🤖 = Claude Code · ✅ = check or test

---

## Phase 0: Accounts, keys and repo setup
**Goal:** an empty monorepo that builds, lints and tests, with every secret in place locally.

### 0.1 Accounts and keys 🧑
- [x] DeepL API account and key (record the plan used and its character allowance)
- [x] ~~Anthropic API key~~ (replaced by Gemini on 2026-10-14)
- [ ] Gemini API key from aistudio.google.com (free tier)
- [x] MongoDB Atlas: free M0 cluster, database user, network access, connection string
- [ ] Vercel account (Hobby) linked to GitHub
- [x] GitHub repository created (private)
- [x] PostHog project (US or EU cloud), project API key and host
- [x] Google Cloud OAuth client (Web): authorized redirect `http://localhost:3000/api/auth/callback/google` (add the production URL in Phase 6)
- [x] Email provider for magic links (Resend recommended, free tier), API key, sender domain or address
- [ ] Chrome Web Store developer account ($5 one-time), needed by Phase 6
- [ ] Firefox Add-ons developer account (free), needed by Phase 6

### 0.2 Monorepo scaffold 🤖
- [x] `git init`, `.gitignore` (node_modules, .env*, .output, .next, .wxt, dist)
- [x] Root `package.json` with pnpm workspaces (`apps/*`, `packages/*`) and `packageManager` pinned
- [x] `turbo.json` with `dev`, `build`, `lint`, `typecheck` and `test` pipelines
- [x] Shared `tsconfig.base.json` (strict, `moduleResolution: bundler`)
- [x] ESLint (flat config) and Prettier at the root
- [x] Vitest config (per-package `vitest run`, orchestrated by Turborepo)
- [x] `.env.example` at `apps/web/.env.example` listing every variable (no values):
      `MONGODB_URI`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
      `RESEND_API_KEY`, `EMAIL_FROM`, `DEEPL_API_KEY`, `DEEPL_API_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`,
      `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `EXTENSION_IDS` (comma-separated), `ANON_DAILY_LIMIT=30`
- [x] `apps/extension/.env.example`: `WXT_API_BASE_URL`, `WXT_POSTHOG_KEY`, `WXT_POSTHOG_HOST`
- [x] 🧑 Copy both to `.env.local` / `.env` and fill in values
- [x] Root `README.md`: prerequisites, setup, `pnpm dev`, how to load the unpacked extension

### 0.3 Shared package 🤖
- [x] `packages/shared` set up (TypeScript, exports map, zod dependency)
- [x] `src/languages.ts`: supported languages, `Direction` type (`es->en`, `en->es`, plus a generic `{source, target}`)
- [x] `src/schemas.ts`: zod schemas for `TranslateRequest/Response`, `ExplainRequest`, `Explanation`, `Card`, `ReviewRequest`, `WaitlistRequest`
- [x] `src/text.ts`: `normalizeSelection()` (trim, collapse whitespace, max length) and `extractSentence()` helper

### ✅ Exit criteria
- [x] `pnpm install && pnpm build && pnpm lint && pnpm typecheck && pnpm test` all pass from a clean clone
- [x] Unit tests for `normalizeSelection` and `extractSentence` (Spanish punctuation `¿ ¡`, abbreviations, line breaks)
- [x] First commit pushed to GitHub

---

## Phase 1: Web app foundation (Next.js + MongoDB + auth + landing page)
**Goal:** users can sign up and sign in, and a public landing page collects waitlist emails.

### 1.1 Next.js app 🤖
- [x] `apps/web`: Next.js (App Router, TypeScript, Tailwind CSS)
- [x] Base layout, typography, light and dark themes, works on a phone
- [x] `lib/env.ts`: validates environment variables with zod at startup (fails fast on missing keys)

### 1.2 MongoDB 🤖
- [x] `lib/db.ts`: a single shared `MongoClient` (reused across hot reloads and serverless calls)
- [x] `lib/collections.ts`: typed accessors for `cards`, `reviewLogs`, `usage`, `explainCache`, `waitlist`
- [x] `scripts/ensure-indexes.ts`:
  - [x] `cards`: `{userId:1, due:1}`, `{userId:1, createdAt:-1}`, unique `{userId:1, textNorm:1, direction:1}`
  - [x] `reviewLogs`: `{userId:1, reviewedAt:-1}`
  - [x] `usage`: unique `{key:1, day:1}` plus a TTL index on `expiresAt`
  - [x] `explainCache`: unique `{hash:1}`
  - [x] `waitlist`: unique `{email:1}`
- [x] ✅ Run the script against Atlas and confirm the indexes (`pnpm --filter web db:indexes`: 9 indexes)

### 1.3 Authentication (Better Auth) 🤖
- [x] Install `better-auth`; `lib/auth.ts` with the MongoDB adapter
- [x] Google OAuth provider
- [x] Magic-link plugin sending through Resend
- [x] Bearer plugin (lets the extension authenticate with `Authorization: Bearer <token>`)
- [x] `app/api/auth/[...all]/route.ts` handler
- [x] `lib/session.ts`: `requireUser(req)` reads a cookie **or** bearer session and returns `userId` or a 401
- [x] Pages: `/sign-in` (Google button + email field), `/account` (email, sign out, delete account)
- [x] ✅ Signing in with Google and with a magic link both work locally; signing out works; `/account` redirects when signed out

### 1.4 Landing page and waitlist 🤖
- [x] `/`: headline aimed at Spanish learners, a short demo GIF placeholder, "Add to Chrome" button (link placeholder), waitlist form
- [x] `POST /api/waitlist`: zod-validated, deduplicated, stores `{email, source, createdAt}`
- [x] `/privacy`: a plain-language privacy policy ("only the text you select and its sentence leave your browser"; what's stored; how to delete it)
- [x] ✅ Submitting the waitlist form twice with the same email stores one record; an invalid email is rejected with a clear message

### ✅ Exit criteria
- [x] Sign up, sign in and sign out work end to end
- [x] Waitlist entries reach Atlas
- [x] `requireUser` has unit tests (cookie session, bearer session, missing or invalid)

---

## Phase 2: Translation and explanation APIs
**Goal:** fast, cached, rate-limited `/api/translate` and `/api/explain` endpoints.

### 2.1 Translate (DeepL) 🤖
- [x] `lib/deepl.ts`: calls `POST /v2/translate` with `text`, `target_lang`, optional `source_lang`, and `context` (the surrounding sentence)
- [x] Map our language codes to DeepL's (`EN-US`, `ES`)
- [x] `POST /api/translate`: request `{text, sentence, targetLang, sourceLang?}` → response `{translation, detectedSourceLang}`
- [x] Short timeout (about 5s), clear error responses (`429`, `502`), and never leaks the API key
- [x] Log character count per request (for the cost check)
- [x] ✅ Unit test with DeepL mocked; manual curl test against the real API (`es → en` and `en → es`). Found: DeepL labels short Spanish like "me da igual" as Portuguese, so `resolveDirection` treats an unsupported detected language as the learning language

### 2.2 Explain (Gemini; first built on Claude) 🤖
- [x] Check the SDK's current API for streaming and structured output before writing this (read the installed `@google/genai` 2.29 type definitions)
- [x] `packages/shared/src/prompt.ts`:
  - [x] System prompt: a language tutor that explains in the learner's **native** language, accurately and concisely, without making up etymology
  - [x] Input: selection, sentence, source and target languages, learner's native language
  - [x] Output JSON schema (`Explanation`): `meaningInContext`, `nuance` (why this word here, near-synonyms and how they differ), `register` (formal, neutral, informal, slang), `grammarNote?`, `examples[2]` `{source, translation}`, `ipa`, `partOfSpeech?`, `lemma?`
- [x] `lib/gemini.ts`: `@google/genai` client, model from `GEMINI_MODEL` (default `gemini-flash-lite-latest`), max output tokens capped (1024), structured output via `responseJsonSchema` (generated from the zod schema), minimal thinking. Replaced `lib/claude.ts` (Claude Haiku) on 2026-10-14
- [x] `POST /api/explain`: streams newline-delimited JSON events (`delta` / `reset` / `done` / `error`, see `ExplainStreamEventSchema`); validates the final JSON with zod; on failure retries once (not for 4xx errors such as a bad key or a 429; a 429 tells the user explanations are busy), then returns a friendly error and refunds the quota
- [x] Log input and output tokens per request
- [ ] ✅ Unit tests: prompt builder snapshots; parser accepts recorded good responses and rejects malformed ones
- [ ] ✅ Manual check: 10 sample phrases (ser/estar, por/para, subjunctive, idioms like "echar de menos", and English phrasal verbs for the `en→es` direction); read the output for quality

### 2.3 Cache 🤖
- [x] `lib/cache.ts`: `hash = sha256(normalize(selection) | normalize(sentence) | source | target | promptVersion)`
- [x] `/api/explain` and `/api/translate` check the cache first and store the result after a successful call
- [x] Include `promptVersion` so that changing the prompt invalidates old entries
- [x] ✅ Test: the second identical request makes no API call (mock asserts it was called once)

### 2.4 Rate limiting and free-tier limits 🤖
- [x] `lib/rateLimit.ts`: atomic `findOneAndUpdate` with `$inc` on `usage` `{key, day}`; `expiresAt` set 2 days ahead
- [x] Anonymous users: key = `anon:<installId>` (a UUID sent in the `X-Install-Id` header), **30 explanations/day**
- [x] Signed-in free users: key = `user:<userId>`, the same 30/day (it lives in config and **must never be lowered after launch**)
- [x] Translation-only calls get a generous separate limit (e.g. 300/day) to stop abuse
- [x] Cache hits do **not** count toward the limit
- [x] A per-IP limit as a backstop against install-ID cycling (300 explanations, 3000 translations per IP per day; only a keyed hash of the IP is stored)
- [x] The response includes `X-Usage-Remaining` (on `/api/explain`); `GET /api/usage` returns the remaining count for the extension popup
- [x] ✅ Tests: the 31st call returns 429 with a friendly message; the counter resets the next UTC day; cache hits are free

### 2.5 CORS and extension access 🤖
- [x] API routes allow `chrome-extension://<id>` origins listed in `EXTENSION_IDS` and any `moz-extension://` origin (Firefox assigns a random ID per install, so it can't be listed)
- [x] Handle `OPTIONS` preflight requests
- [x] ✅ A request from an unknown origin is rejected

### ✅ Exit criteria
- [ ] `es→en` and `en→es` both work through curl with real keys
- [ ] Average latency recorded: translate < 1s, explanation's first token < 1.5s (note the actual numbers here: translate 0.17–0.66s uncached, ~0.09s cached; explanation ______)
- [ ] All Phase 2 tests pass

---

## Phase 3: Browser extension (WXT + React)
**Goal:** select text on any page → popover with translation, explanation, pronunciation and a save button.

### 3.1 Scaffold 🤖
- [ ] `apps/extension` with WXT + React + TypeScript
- [ ] `wxt.config.ts`: Manifest V3, name and description, icons, permissions `["storage"]`, content script on `<all_urls>`, `externally_connectable.matches` = the web app origin
- [ ] Builds for Chrome and Firefox (`wxt build -b firefox`)
- [ ] ✅ Load unpacked in Chrome; no errors in the service worker console

### 3.2 Background (service worker) 🤖
- [ ] Creates an `installId` (UUID) on first install and stores it in `chrome.storage.local`
- [ ] API client using `packages/shared` schemas; attaches `X-Install-Id` and the bearer token if present
- [ ] Message handlers: `translate`, `explain` (relays the stream to the content script through a port), `saveCard`, `getUsage`, `getAuthState`
- [ ] Listens for external messages from the web app: `{type:'AUTH_TOKEN', token}`, validates the sender origin, stores the token
- [ ] On 401, clears the token and reports a signed-out state
- [ ] ✅ Unit tests for the API client (fetch mocked)

### 3.3 Content script: selection, button, popover 🤖
- [ ] Listens for `mouseup` / `selectionchange`; ignores inputs, textareas and contenteditable fields (an option can enable them later); ignores selections longer than about 300 characters (shows a "select less text" hint)
- [ ] Extracts the surrounding sentence from the selection's text node or block using `extractSentence`
- [ ] Shows a small floating button near the selection; clicking it opens the popover
- [ ] The popover is rendered inside a **Shadow DOM** with its own styles (page CSS can't break it, and it can't break the page)
- [ ] Popover contents:
  - [ ] Selected text with a 🔊 button (`speechSynthesis`, picking an `es-ES`/`es-MX` or `en-US` voice; graceful fallback if none)
  - [ ] Translation (shows immediately)
  - [ ] Explanation streaming in: meaning, nuance, register, grammar note, 2 examples, IPA
  - [ ] **Save** button (shows "Sign in to save" when signed out, which opens `/sign-in?from=extension`)
  - [ ] Remaining daily explanations ("27 left today"), shown subtly with **no nag banners**
  - [ ] Loading skeleton and error states (out of quota, offline, API error)
- [ ] Closes on Esc, on a click outside, or on scroll far away; positions itself to stay in view
- [ ] Direction detection: the user's settings (native and learning language) plus DeepL's detected source language → choose `es→en` or `en→es`
- [ ] ✅ Manual: works on elpais.com, bbc.com, wikipedia.org, reddit.com and a Google Docs preview (note where it fails)
- [ ] ✅ No noticeable slowdown on pages when the popover is idle; nothing logged to the console on pages where it isn't used

### 3.4 Popup and onboarding 🤖
- [ ] On first install, opens an onboarding tab on the web app: choose native language (English or Spanish) and learning language; saved to `chrome.storage.sync`
- [ ] Toolbar popup: sign-in state, today's usage, "Review N due cards" link, language settings, a toggle to pause on the current site
- [ ] ✅ Changing settings in the popup changes the translation direction immediately

### 3.5 Connecting the extension to an account 🤖
- [ ] Web page `/extension/connect`: requires sign-in, gets a bearer token, calls `chrome.runtime.sendMessage(EXTENSION_ID, {type:'AUTH_TOKEN', token})`, and shows "Connected ✓"
- [ ] Firefox fallback: `externally_connectable` isn't supported there, so use a content script on the web app origin that relays a `window.postMessage` to the background
- [ ] ✅ Signing in through "Sign in to save" ends with the extension signed in, in both Chrome and Firefox

### ✅ Exit criteria
- [ ] The full flow works on a real news site: select → translate → explanation → listen → save (once Phase 4's API exists)
- [ ] Playwright end-to-end test: load the unpacked Chromium extension, open `fixtures/spanish.html`, select a word, check the popover shows the mocked translation and explanation

---

## Phase 4: Cards, spaced repetition and the review app
**Goal:** saved items become cards reviewed with FSRS in a web app that works on a phone, with a daily streak.

### 4.1 Cards API 🤖
- [ ] `POST /api/cards`: needs an account; body `{text, translation, explanation, sentence, url, pageTitle, direction}`; upserts on `{userId, textNorm, direction}` (re-saving adds the new sentence to `contexts[]` instead of duplicating the card)
- [ ] Creates the FSRS state with `ts-fsrs` `createEmptyCard()`; `due = now`
- [ ] `GET /api/cards?cursor=`: list with pagination; `DELETE /api/cards/:id`; `PATCH /api/cards/:id` (edit the translation or a note)
- [ ] ✅ Tests: create, deduplicate, list, delete, and auth required (401 without a session)

### 4.2 Scheduling 🤖
- [ ] `lib/srs.ts`: wraps `ts-fsrs` (default parameters, `request_retention: 0.9`); `grade(card, rating, now)` → the new card state plus a review log
- [ ] `GET /api/reviews/due?limit=20`: due cards for the user (`due <= now`), plus up to 10 new cards a day
- [ ] `POST /api/reviews`: `{cardId, rating: Again|Hard|Good|Easy}` → updates the card and inserts into `reviewLogs`
- [ ] ✅ Unit tests: `Good` on a new card schedules it later than `Again`; the review log is written; another user can't review cards that aren't theirs

### 4.3 Review page `/review` 🤖
- [ ] Layout that works on a phone first: the card front shows the word **inside its original sentence** (the word highlighted) and 🔊
- [ ] "Show answer" → translation, meaning, nuance, examples, a link to the source page
- [ ] Four rating buttons with the next interval shown on each (e.g. "Good · 3d"); keyboard shortcuts 1–4 and space on desktop
- [ ] End-of-session screen: cards reviewed, streak, "come back tomorrow"
- [ ] Works as an installable PWA (manifest + icons) so phone users can add it to their home screen
- [ ] ✅ Manual: a full 10-card session at 375px width and on a desktop

### 4.4 Cards library `/cards` 🤖
- [ ] Searchable list (text or translation), filter by direction, delete, link to the source page
- [ ] ✅ Deleting a card removes it from the review queue

### 4.5 Streak 🤖
- [ ] Streak = consecutive days (in the user's time zone, stored on the profile) with at least 1 review **or** at least 1 save
- [ ] `GET /api/me/stats`: `{streak, dueCount, reviewedToday, totalCards}`
- [ ] Shown on `/review`, `/cards` and in the extension popup
- [ ] ✅ Unit tests for the streak calculation: time-zone edges, gaps, the same day

### ✅ Exit criteria
- [ ] Save in the extension → card appears in `/cards` → shows up in `/review` → grading reschedules it
- [ ] Streak increases after a review on consecutive days (simulated in tests)

---

## Phase 5: Analytics, fake upgrade button and polish
**Goal:** measure the go/no-go metrics, and test willingness to pay without billing.

### 5.1 PostHog 🤖
- [ ] Web: `posthog-js` provider; identify on sign-in (user ID only, **no email**)
- [ ] Extension: lightweight capture through the background script (`installId` as the distinct ID, linked to `userId` on sign-in)
- [ ] Events:
  - [ ] `extension_installed`, `onboarding_completed`
  - [ ] `explain_shown` {direction, cached, latencyMs}
  - [ ] `card_saved` {direction}
  - [ ] `review_completed` {rating}, `review_session_finished` {count}
  - [ ] `streak_day` {streak}
  - [ ] `quota_hit`
  - [ ] `upgrade_clicked` {source}, `pro_waitlist_joined`
- [ ] Never send the selected text or URLs to analytics
- [ ] PostHog dashboard: D1/D7 retention cohort on `review_completed`; funnel install → explain → save → review → upgrade click
- [ ] ✅ Each event shows up in PostHog's live events view with the expected properties

### 5.2 Fake upgrade door 🤖
- [ ] "Upgrade ✨" link in the extension popup, the end-of-review screen and the quota-reached state (**the only place it's highlighted**)
- [ ] `/pro`: honest copy, "Pro is coming: unlimited explanations, deeper grammar breakdowns, Anki export, choose your AI model. $6/mo. Join early access." Email form → `waitlist` with `source: 'pro'`
- [ ] Optional short question: "What would make Pro worth paying for?"
- [ ] ✅ Clicking it logs `upgrade_clicked`; submitting logs `pro_waitlist_joined` and stores the email

### 5.3 Polish and trust 🤖
- [ ] "Disable on this site" list respected by the content script
- [ ] Account deletion removes the user's cards, review logs and usage records
- [ ] Data export (JSON) on `/account` (signals trust; becomes the base for Anki export later)
- [ ] Error reporting: catch errors and log them to the console and PostHog `error` events (no page content)
- [ ] Accessibility pass on the popover and review page: focus trapping, ARIA labels, contrast
- [ ] ✅ A light Lighthouse pass on `/` and `/review` (performance and accessibility ≥ 90)

### ✅ Exit criteria
- [ ] All metrics needed for go/no-go are visible on one PostHog dashboard
- [ ] No upgrade prompts outside the 3 places listed above

---

## Phase 6: Deploy and publish
**Goal:** a production web app on Vercel and an extension that test users can install.

### 6.1 Production web app
- [ ] 🧑 Create a Vercel project from the GitHub repo (root `apps/web`, the Turborepo preset)
- [ ] 🧑 Add all environment variables in Vercel (Production + Preview)
- [ ] 🧑 Atlas network access: allow Vercel (`0.0.0.0/0` with a strong password for the MVP, or Vercel's IP list)
- [ ] 🧑 Add the production Google OAuth redirect URL; verify the Resend sender domain
- [ ] 🤖 Run `ensure-indexes` against production
- [ ] 🤖 Check that streaming works for `/api/explain` on Vercel functions (Node runtime, `maxDuration` set)
- [ ] ✅ Smoke test on production: sign in, waitlist, translate, explain, save, review
- [ ] (Optional) 🧑 custom domain

### 6.2 Extension release
- [ ] 🤖 Set the production `WXT_API_BASE_URL`; bump the version; `wxt zip` for Chrome and Firefox
- [ ] 🤖 Store assets: 128px icon, 3–5 screenshots (1280×800), a short promo tile, store description (Spanish-learner focused), privacy policy URL, single-purpose statement, explanation of each permission (`<all_urls>`: to detect text selection on pages you read)
- [ ] 🧑 Submit to the Chrome Web Store as **Unlisted** (review takes from a few days to about 2 weeks)
- [ ] 🧑 Submit to Firefox Add-ons (listed or self-distributed)
- [ ] 🤖 Add the final extension IDs to `EXTENSION_IDS` and `externally_connectable`; redeploy
- [ ] ✅ Install from the store on a clean Chrome profile and run the full flow

### ✅ Exit criteria
- [ ] A new user can go from the landing page → install → first explanation → save → review with no help

---

## Phase 7: Validation (3–4 weeks)
**Goal:** decide whether to go on, change direction or stop, based on data.

### 7.1 Quality check 🧑 + 🤖
- [ ] 🤖 Export 50 random cached explanations (25 `es→en`, 25 `en→es`) to a review sheet
- [ ] 🧑 A bilingual reviewer rates each one: correct, minor issue, or wrong
- [ ] 🤖 Fix the prompt for the issues found; bump `promptVersion`
- [ ] ✅ At least 90% rated "correct" before recruiting widely

### 7.2 Recruit 30–50 learners 🧑
- [ ] Short demo GIF/video (selecting a tricky Spanish phrase → explanation → review)
- [ ] Posts (following each community's rules on self-promotion): r/Spanish, r/learnspanish, r/languagelearning, r/EnglishLearning, 2–3 Spanish-learning Discord servers
- [ ] Optional: personally message 10 Spanish-learning content creators and tutors
- [ ] Track signups by source (`?ref=` on landing links)

### 7.3 Learn from users 🧑
- [ ] 5–8 short user calls (15 min): what they read, what they saved, would they pay, what's missing
- [ ] In-app feedback link (a simple form)
- [ ] Weekly notes in `docs/validation-log.md`

### 7.4 Go/no-go (end of week 4)
- [ ] Day-7 review retention ≥ 25% of activated users (activated = saved ≥ 3 cards). Actual: ____
- [ ] ≥ 10 `upgrade_clicked` or Pro waitlist signups. Actual: ____
- [ ] Unprompted praise that mentions the explanations specifically (collect quotes)
- [ ] Cost per active user per month: ____ (must be well under the planned $6 price)
- [ ] **Decision:** ☐ Go (build billing, Anki export, model choice, more languages) ☐ Change direction ☐ Stop

---

## Running cost log
| Date | Active users | DeepL chars | LLM tokens (in/out) | Est. cost | Notes |
|---|---|---|---|---|---|
| | | | | | |

## Decisions log
| Date | Decision | Why |
|---|---|---|
| 2026-10-14 | Launch pair: Spanish ↔ English | Strongest DeepL and LLM quality, easy to check, big communities, both directions |
| 2026-10-14 | Hosting: Vercel (Hobby → Pro when charging) | Best fit with Next.js, costs easy to predict; hosting is a small share of total cost |
| 2026-10-14 | DeepL for translation, Claude for explanations | The DeepL API has no explanation or example endpoint |
| 2026-10-14 | MongoDB Atlas + Better Auth | User's preference for Mongo; self-hosted auth with bearer tokens for the extension |
| 2026-10-14 | Working name "Contexto" kept for validation | Conflicts with a word game and with an existing "LingoMate" app; choose the final name before a public launch |
| 2026-10-14 | `/api/explain` streams NDJSON events, not raw text | Lets the client show partial output, discard it on a retry (`reset`) and get a validated final object |
| 2026-10-14 | Store only a keyed hash of IPs for the per-IP limit | Abuse protection without keeping personal data |
| 2026-10-14 | Gemini (free tier) instead of Claude for explanations | Free during validation. Trade-off: on the free tier Google may use prompts to improve its products and reviewers may read them; disclosed on /privacy. Turning on Cloud Billing makes all use paid, which stops that |
