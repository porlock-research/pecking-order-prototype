'use server';

import { headers } from 'next/headers';
import { getDB, getEnv } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { buildPlaytestConfirmationHtml } from '@/lib/email-templates';
import { signupSchema } from './constants';
import { Resend } from 'resend';

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_HOURS = 1;

export async function handlePlaytestSignup(data: {
  email: string;
  referralSource: string;
  referralDetail?: string;
  turnstileToken: string;
}): Promise<{ success?: boolean; error?: string }> {
  const headersList = await headers();
  const ip =
    headersList.get('cf-connecting-ip') ||
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    null;
  return submitPlaytestSignup(data, ip);
}

async function submitPlaytestSignup(
  data: {
    email: string;
    referralSource: string;
    referralDetail?: string;
    turnstileToken: string;
  },
  ipAddress: string | null,
): Promise<{ success?: boolean; error?: string }> {
  // 1. Validate input
  const parsed = signupSchema.safeParse(data);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message || 'Invalid input';
    return { error: firstError };
  }

  const { email, referralSource, referralDetail, turnstileToken } = parsed.data;

  try {
    const env = await getEnv();

    // 2. Verify Turnstile token
    const turnstileSecret = env.TURNSTILE_SECRET_KEY as string | undefined;
    if (turnstileSecret) {
      const turnstileRes = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            secret: turnstileSecret,
            response: turnstileToken,
          }),
        },
      );
      const turnstileResult = (await turnstileRes.json()) as { success: boolean };
      if (!turnstileResult.success) {
        return { error: 'Verification failed. Please try again.' };
      }
    }

    // 3. Rate limit by IP
    const db = await getDB();
    if (ipAddress) {
      const { results: recentSignups } = await db
        .prepare(
          `SELECT COUNT(*) as count FROM PlaytestSignups
           WHERE ip_address = ? AND signed_up_at > datetime('now', ?)`,
        )
        .bind(ipAddress, `-${RATE_LIMIT_WINDOW_HOURS} hours`)
        .all<{ count: number }>();

      if (recentSignups[0] && recentSignups[0].count >= RATE_LIMIT_MAX) {
        return { error: 'Slow down — try again in a bit.' };
      }
    }

    // 4. Insert into D1 (UNIQUE constraint handles dupes)
    try {
      await db
        .prepare(
          `INSERT INTO PlaytestSignups (email, referral_source, referral_detail, ip_address)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(
          email.toLowerCase(),
          referralSource,
          referralDetail || null,
          ipAddress,
        )
        .run();
    } catch (err: any) {
      // UNIQUE constraint violation = already signed up
      if (err?.message?.includes('UNIQUE')) {
        return { success: true }; // Don't leak that email exists
      }
      throw err;
    }

    // 5. Send confirmation email
    const resendApiKey = env.RESEND_API_KEY as string | undefined;
    if (resendApiKey) {
      const assetsUrl = (env.PERSONA_ASSETS_URL as string) || '';
      const lobbyUrl = (env.LOBBY_HOST as string) || '';
      const playtestUrl = (env.PLAYTEST_URL as string) || 'https://playtest.peckingorder.ca';

      const html = buildPlaytestConfirmationHtml({ assetsUrl, lobbyUrl, playtestUrl });
      await sendEmail(email, "You're on the list!", html, resendApiKey);

      // 6. Upsert to Resend Audience
      const audienceId = env.RESEND_PLAYTEST_AUDIENCE_ID as string | undefined;
      if (audienceId) {
        const resend = new Resend(resendApiKey);
        await resend.contacts.create({
          email: email.toLowerCase(),
          audienceId,
          unsubscribed: false,
        }).catch((err) => {
          // Non-critical — log but don't fail the signup
          console.error('[Playtest] Audience upsert failed:', err);
        });
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Playtest] Signup error:', err);
    return { error: 'Something went wrong. Please try again.' };
  }
}
