import 'server-only';
import { z } from 'zod';

const EnvSchema = z.object({
  MONGODB_URI: z.string().startsWith('mongodb'),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().startsWith('re_'),
  EMAIL_FROM: z.string().min(3),
  DEEPL_API_KEY: z.string().min(1),
  DEEPL_API_URL: z.url().default('https://api-free.deepl.com'),
  ANTHROPIC_API_KEY: z.string().min(1),
  EXTENSION_IDS: z
    .string()
    .default('')
    .transform((s) =>
      s
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ANON_DAILY_LIMIT: z.coerce.number().int().positive().default(30),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/**
 * Validated server environment. Throws on first use if a variable is missing or
 * malformed, naming each problem (but never printing values).
 */
export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
  }
  cached = parsed.data;
  return cached;
}
