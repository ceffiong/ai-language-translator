# AI Language Translator

A browser extension that translates selected text, explains it in context (nuance, register, examples, IPA), and turns saved words into spaced-repetition cards. It launches with Spanish ↔ English.

- Product plan: [`ai-language-translator-plan.md`](./ai-language-translator-plan.md)
- Build checklist: [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md)

## Repo layout

```
apps/web/         Next.js: landing page, auth, review app, API (DeepL + Claude)
apps/extension/   WXT + React browser extension (Chrome + Firefox)
packages/shared/  zod schemas, types and text helpers shared by both apps
```

## Prerequisites

- Node.js 20+
- pnpm 10 (`npm i -g pnpm@10`)
- Accounts and keys listed in Phase 0.1 of `IMPLEMENTATION_PLAN.md`

## Setup

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local     # fill in values
cp apps/extension/.env.example apps/extension/.env
```

Env files are gitignored. Never commit real keys.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run all apps in dev mode |
| `pnpm build` | Build everything |
| `pnpm lint` | ESLint across the workspace |
| `pnpm typecheck` | TypeScript checks |
| `pnpm test` | Vitest unit tests |
| `pnpm format` | Prettier |

## Load the extension (development)

Added in Phase 3: run `pnpm --filter extension dev`, which opens a Chrome instance with the extension loaded. To load it manually instead, open `chrome://extensions`, enable Developer mode, click **Load unpacked** and select `apps/extension/.output/chrome-mv3`.
