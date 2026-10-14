'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';

export function AccountActions() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setBusy(true);
    await authClient.signOut();
    router.push('/');
    router.refresh();
  }

  async function deleteAccount() {
    setBusy(true);
    setError(null);
    const { error } = await authClient.deleteUser({ callbackURL: '/' });
    if (error) {
      setBusy(false);
      setError(
        error.status === 400 || error.status === 403
          ? 'For your security, please sign out, sign in again, then delete your account.'
          : (error.message ?? 'Could not delete your account. Please try again.'),
      );
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="self-start rounded-lg border border-border bg-surface px-4 py-2 font-medium hover:bg-brand-soft disabled:opacity-60"
      >
        Sign out
      </button>

      <section className="rounded-xl border border-danger/40 p-5">
        <h2 className="font-semibold">Delete account</h2>
        <p className="mt-1 text-sm text-muted">
          Permanently deletes your account, saved words and review history. This can’t be undone.
        </p>
        {confirming ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={deleteAccount}
              disabled={busy}
              className="rounded-lg bg-danger px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {busy ? 'Deleting…' : 'Yes, delete everything'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="rounded-lg border border-border px-4 py-2 font-medium"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-4 rounded-lg border border-danger/60 px-4 py-2 font-medium text-danger hover:bg-danger/10"
          >
            Delete my account
          </button>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
