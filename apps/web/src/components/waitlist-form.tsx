'use client';

import { useState, type FormEvent } from 'react';

type Status =
  { kind: 'idle' } | { kind: 'sending' } | { kind: 'done' } | { kind: 'error'; message: string };

export function WaitlistForm({ source = 'landing' }: { source?: 'landing' | 'pro' }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus({ kind: 'sending' });
    const ref = new URLSearchParams(window.location.search).get('ref');
    try {
      const res = await fetch(`/api/waitlist${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      });
      if (res.ok) {
        setStatus({ kind: 'done' });
        return;
      }
      const body = await res.json().catch(() => null);
      const message: string =
        body?.error?.code === 'bad_request'
          ? 'Please enter a valid email address.'
          : 'Something went wrong. Please try again.';
      setStatus({ kind: 'error', message });
    } catch {
      setStatus({ kind: 'error', message: 'Network error. Please try again.' });
    }
  }

  if (status.kind === 'done') {
    return (
      <p role="status" className="rounded-lg bg-brand-soft px-4 py-3 text-sm font-medium">
        You’re on the list. We’ll email you when it’s ready.
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-md flex-col gap-2 sm:flex-row"
      noValidate
    >
      <label htmlFor={`waitlist-${source}`} className="sr-only">
        Email address
      </label>
      <input
        id={`waitlist-${source}`}
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-invalid={status.kind === 'error'}
        aria-describedby={status.kind === 'error' ? `waitlist-${source}-error` : undefined}
        className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
      />
      <button
        type="submit"
        disabled={status.kind === 'sending'}
        className="rounded-lg bg-brand px-4 py-2.5 font-medium text-brand-contrast hover:opacity-90 disabled:opacity-60"
      >
        {status.kind === 'sending' ? 'Joining…' : 'Join the waitlist'}
      </button>
      {status.kind === 'error' && (
        <p
          id={`waitlist-${source}-error`}
          role="alert"
          className="text-sm text-danger sm:basis-full"
        >
          {status.message}
        </p>
      )}
    </form>
  );
}
