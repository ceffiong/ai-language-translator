import { WaitlistRequestSchema } from '@ai-translator/shared';
import { apiError, parseJson } from '@/lib/api';
import { collections } from '@/lib/collections';

export async function POST(request: Request) {
  const { data, error } = await parseJson(request, WaitlistRequestSchema);
  if (error) return error;

  const ref = new URL(request.url).searchParams.get('ref')?.slice(0, 64) || undefined;

  try {
    // Upsert so joining twice is harmless and doesn't reveal whether an email exists.
    await collections.waitlist().updateOne(
      { email: data.email, source: data.source },
      {
        $setOnInsert: { email: data.email, source: data.source, createdAt: new Date(), ref },
        ...(data.note ? { $set: { note: data.note } } : {}),
      },
      { upsert: true },
    );
  } catch (err) {
    console.error('waitlist insert failed', err);
    return apiError('internal', 'Something went wrong. Please try again.');
  }

  return Response.json({ ok: true });
}
