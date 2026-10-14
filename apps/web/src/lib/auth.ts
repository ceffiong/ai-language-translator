import 'server-only';
import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { nextCookies } from 'better-auth/next-js';
import { bearer, magicLink } from 'better-auth/plugins';
import { db, mongoClient } from './db';
import { sendMagicLinkEmail } from './email';
import { env } from './env';
import { SITE } from './site';

function extensionOrigins(): string[] {
  return env().EXTENSION_IDS.flatMap((id) => [`chrome-extension://${id}`, `moz-extension://${id}`]);
}

export const auth = betterAuth({
  appName: SITE.name,
  baseURL: env().BETTER_AUTH_URL,
  secret: env().BETTER_AUTH_SECRET,
  database: mongodbAdapter(db(), { client: mongoClient() }),
  trustedOrigins: extensionOrigins(),
  socialProviders: {
    google: {
      clientId: env().GOOGLE_CLIENT_ID,
      clientSecret: env().GOOGLE_CLIENT_SECRET,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days: learners come back daily, don't make them re-login
    updateAge: 60 * 60 * 24,
  },
  user: {
    deleteUser: {
      enabled: true,
      afterDelete: async (user) => {
        // Remove everything the learner created. Usage counters expire on their own.
        const database = db();
        await Promise.all([
          database.collection('cards').deleteMany({ userId: user.id }),
          database.collection('reviewLogs').deleteMany({ userId: user.id }),
        ]);
      },
    },
  },
  plugins: [
    magicLink({
      expiresIn: 60 * 10,
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail(email, url);
      },
    }),
    // Lets the browser extension authenticate with `Authorization: Bearer <token>`.
    bearer(),
    // Must stay last: lets server actions set auth cookies.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
