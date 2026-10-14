import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { AccountActions } from './account-actions';

export const metadata: Metadata = { title: 'Account' };

export default function AccountPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <AccountDetails />
      </Suspense>
    </main>
  );
}

async function AccountDetails() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in?next=/account');

  const { user } = session;
  return (
    <div className="mt-6 flex flex-col gap-8">
      <dl className="rounded-xl border border-border bg-surface p-5">
        <dt className="text-sm text-muted">Signed in as</dt>
        <dd className="mt-1 font-medium">{user.email}</dd>
        {user.name && user.name !== user.email && (
          <dd className="text-sm text-muted">{user.name}</dd>
        )}
      </dl>
      <AccountActions />
    </div>
  );
}
