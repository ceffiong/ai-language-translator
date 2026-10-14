import type { Metadata } from 'next';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'Privacy' };

const UPDATED = '14 October 2026';

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-2 text-sm text-muted">Last updated {UPDATED}</p>

      <div className="mt-8 flex flex-col gap-8 leading-7">
        <Section title="The short version">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>
                Only the text you select, and the sentence around it, leave your browser.
              </strong>{' '}
              We never read, store or send the rest of the page or your browsing history.
            </li>
            <li>We don’t sell your data or show ads.</li>
            <li>You can delete your account and everything in it at any time.</li>
          </ul>
        </Section>

        <Section title="What the extension sends">
          <p>
            When you click the {SITE.name} button after selecting text, the extension sends the
            selected text and the sentence it appears in to our server so we can translate and
            explain it. If you save a word, we also store the page’s address and title so you can go
            back to where you found it. Nothing is sent unless you click.
          </p>
        </Section>

        <Section title="Services we use">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>DeepL</strong> translates the selected text.
            </li>
            <li>
              <strong>Anthropic (Claude)</strong> writes the explanation of the selected text.
            </li>
            <li>
              <strong>MongoDB Atlas</strong> stores your account and saved words.
            </li>
            <li>
              <strong>Resend</strong> sends sign-in emails.
            </li>
            <li>
              <strong>PostHog</strong> collects anonymous usage events (e.g. “a word was saved”) so
              we can tell what’s working. It never receives the text you select or the pages you
              visit.
            </li>
          </ul>
        </Section>

        <Section title="What we store">
          <ul className="list-disc space-y-2 pl-5">
            <li>Your account: email, name and profile picture (if you sign in with Google).</li>
            <li>Words you save, with their translation, explanation, sentence and page.</li>
            <li>Your review history, to schedule your reviews.</li>
            <li>
              A random install ID and daily usage counts, to apply the free daily limit. These
              expire after two days.
            </li>
            <li>
              Translations and explanations are cached without any link to who asked for them, so
              repeat lookups are faster.
            </li>
          </ul>
        </Section>

        <Section title="Your choices">
          <p>
            You can use translations and explanations without an account. You can delete your
            account from the Account page, which permanently removes your saved words and review
            history. Questions? Contact us at the email address on our listing in the extension
            store.
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-3 text-foreground/90">{children}</div>
    </section>
  );
}
