'use server';

import { headers } from 'next/headers';
import { getDB, getEnv } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { buildPlaytestConfirmationHtml } from '@/lib/email-templates';
import { signupSchema } from './constants';
import { Resend } from 'resend';

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_HOURS = 1;

/** Generate a 6-char uppercase alphanumeric referral code */
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid ambiguity
  let code = '';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) code += chars[b % chars.length];
  return code;
}

export async function handlePlaytestSignup(data: {
  email: string;
  referralSource: string;
  referralDetail?: string;
  phone?: string;
  messagingApp?: string;
  referredBy?: string;
  turnstileToken: string;
}): Promise<{ success?: boolean; referralCode?: string; error?: string }> {
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
    phone?: string;
    messagingApp?: string;
    referredBy?: string;
    turnstileToken: string;
  },
  ipAddress: string | null,
): Promise<{ success?: boolean; referralCode?: string; error?: string }> {
  // 1. Validate input
  const parsed = signupSchema.safeParse(data);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message || 'Invalid input';
    return { error: firstError };
  }

  const { email, referralSource, referralDetail, phone, messagingApp, turnstileToken } = parsed.data;

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
    const referralCode = generateReferralCode();
    const referredBy = data.referredBy?.trim().toUpperCase() || null;

    try {
      await db
        .prepare(
          `INSERT INTO PlaytestSignups (email, referral_source, referral_detail, phone, messaging_app, ip_address, turnstile_token, referral_code, referred_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          email.toLowerCase(),
          referralSource,
          referralDetail || null,
          phone || null,
          messagingApp || null,
          ipAddress,
          turnstileToken,
          referralCode,
          referredBy,
        )
        .run();
    } catch (err: any) {
      // UNIQUE constraint violation = already signed up
      if (err?.message?.includes('UNIQUE')) {
        // Fetch their existing referral code (may be null for pre-migration signups)
        const existing = await db
          .prepare('SELECT referral_code FROM PlaytestSignups WHERE email = ?')
          .bind(email.toLowerCase())
          .first<{ referral_code: string | null }>();

        let code = existing?.referral_code;
        if (!code) {
          // Backfill referral code for pre-migration signups
          code = referralCode;
          await db
            .prepare('UPDATE PlaytestSignups SET referral_code = ? WHERE email = ?')
            .bind(code, email.toLowerCase())
            .run();
        }
        return { success: true, referralCode: code };
      }
      throw err;
    }

    // 5. Send confirmation email
    const resendApiKey = env.RESEND_API_KEY as string | undefined;
    if (resendApiKey) {
      const assetsUrl = (env.PERSONA_ASSETS_URL as string) || '';
      const lobbyUrl = (env.LOBBY_HOST as string) || '';
      const playtestUrl = (env.PLAYTEST_URL as string) || 'https://playtest.peckingorder.ca';

      const html = buildPlaytestConfirmationHtml({ assetsUrl, lobbyUrl, playtestUrl, referralCode });
      await sendEmail(email, "You're on the list!", html, resendApiKey);

      // 6. Upsert to Resend Contacts (with segment + properties for segmentation)
      const segmentId = env.RESEND_PLAYTEST_SEGMENT_ID as string | undefined;
      if (segmentId) {
        const resend = new Resend(resendApiKey);
        await resend.contacts.create({
          email: email.toLowerCase(),
          unsubscribed: false,
          segments: [{ id: segmentId }],
          properties: {
            referral_source: referralSource,
            signed_up_at: new Date().toISOString(),
          },
        }).catch((err) => {
          // Non-critical — log but don't fail the signup
          console.error('[Playtest] Contact upsert failed:', err);
        });
      }
    }

    return { success: true, referralCode };
  } catch (err: any) {
    console.error('[Playtest] Signup error:', err);
    return { error: 'Something went wrong. Please try again.' };
  }
}
