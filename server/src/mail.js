// Outgoing email: "forgot password" codes and support answers to people who wrote in signed out.
// Two ways to send, whichever is set up (both need a domain you own):
//   - Resend: `npx wrangler secret put RESEND_API_KEY` (resend.com, free tier), or
//   - Cloudflare Email Service: a send_email binding named EMAIL in wrangler.jsonc.
// EMAIL_FROM (wrangler.jsonc vars) is the sender, e.g. "Dobha-Dobha <hello@yourdomain.co.za>".
import { HttpError } from './http.js';

export const canSendEmail = (env) => Boolean(env.EMAIL_FROM && (env.RESEND_API_KEY || env.EMAIL));

/** Sends one email, or throws a 503 when no sender is set up. */
export async function sendEmail(env, { to, subject, text, html }) {
  if (!canSendEmail(env)) throw new HttpError(503, 'Sending email is not available yet');

  if (env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text, ...(html ? { html } : {}) }),
    });
    if (!res.ok) {
      console.error('Resend failed', res.status, await res.text());
      throw new HttpError(502, 'Could not send the email, try again in a minute');
    }
    return;
  }

  await env.EMAIL.send({ to, from: env.EMAIL_FROM, subject, text, ...(html ? { html } : {}) });
}
