import 'server-only';
import { Resend } from 'resend';
import { env } from './env';
import { SITE } from './site';

let resend: Resend | undefined;

function client(): Resend {
  resend ??= new Resend(env().RESEND_API_KEY);
  return resend;
}

export async function sendMagicLinkEmail(to: string, url: string): Promise<void> {
  const { error } = await client().emails.send({
    from: `${SITE.name} <${env().EMAIL_FROM}>`,
    to,
    subject: `Your ${SITE.name} sign-in link`,
    text: `Sign in to ${SITE.name}:\n\n${url}\n\nThis link expires in 10 minutes. If you didn't ask for it, you can ignore this email.`,
    html: `<p>Sign in to <strong>${SITE.name}</strong>:</p>
<p><a href="${url}" style="display:inline-block;padding:10px 16px;background:#0f766e;color:#fff;border-radius:8px;text-decoration:none">Sign in</a></p>
<p style="color:#666;font-size:13px">This link expires in 10 minutes. If you didn't ask for it, you can ignore this email.</p>`,
  });
  if (error) throw new Error(`Failed to send sign-in email: ${error.message}`);
}
