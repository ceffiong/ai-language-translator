import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-muted">Save words and review them on any device.</p>
      <Suspense fallback={<div className="mt-8 h-48" />}>
        <SignInForm />
      </Suspense>
    </main>
  );
}
