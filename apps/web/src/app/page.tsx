import { WaitlistForm } from '@/components/waitlist-form';
import { SITE } from '@/lib/site';

const STEPS = [
  {
    title: 'Select',
    body: 'Highlight any word or phrase on the page you’re reading, like a news article, a Reddit thread or a recipe.',
  },
  {
    title: 'Understand',
    body: 'Get the translation, plus why that word is used there: nuance, formality, grammar and real examples, with pronunciation.',
  },
  {
    title: 'Remember',
    body: 'Save it with the sentence you found it in. Short daily reviews bring it back right before you’d forget it.',
  },
];

const PROMISES = [
  {
    title: 'Explains, not just translates',
    body: '“Echar de menos” or “extrañar”? “Por” or “para”? You see why, in plain language, every time.',
  },
  {
    title: 'Free means free',
    body: 'Translations and 30 explanations a day, free, with no account needed. We won’t quietly take features away later.',
  },
  {
    title: 'Private by design',
    body: 'Only the text you select and its sentence leave your browser. No browsing history, no selling data.',
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      <section className="flex flex-col items-start gap-6 py-16 sm:py-24">
        <p className="rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-foreground">
          For Spanish ↔ English learners
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          {SITE.tagline}
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-muted">{SITE.description}</p>
        <WaitlistForm />
        <p className="text-sm text-muted">
          A browser extension for Chrome and Firefox. Coming soon.
        </p>
      </section>

      <section aria-labelledby="how" className="border-t border-border py-14">
        <h2 id="how" className="text-2xl font-semibold tracking-tight">
          How it works
        </h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-xl border border-border bg-surface p-5">
              <span className="text-sm font-semibold text-brand">Step {i + 1}</span>
              <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 leading-7 text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="why" className="border-t border-border py-14">
        <h2 id="why" className="text-2xl font-semibold tracking-tight">
          Why it’s different
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {PROMISES.map((p) => (
            <div key={p.title}>
              <h3 className="text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 leading-7 text-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col items-start gap-4 border-t border-border py-14">
        <h2 className="text-2xl font-semibold tracking-tight">Be first to try it</h2>
        <p className="text-muted">We’re inviting a small group of learners first.</p>
        <WaitlistForm />
      </section>
    </main>
  );
}
