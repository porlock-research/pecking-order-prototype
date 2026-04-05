'use server';

import { getDB, getEnv } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { buildPlaytestConfirmationHtml } from '@/lib/email-templates';
import { deriveKeys, encrypt, hmac } from '@/lib/crypto';
import { signupSchema } from './constants';
import { Resend } from 'resend';

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
  return submitPlaytestSignup(data);
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

    // 3. Encrypt PII (required post-Phase-2)
    const db = await getDB();
    const piiKey = env.PII_ENCRYPTION_KEY as string | undefined;
    if (!piiKey) {
      throw new Error('PII_ENCRYPTION_KEY is required');
    }

    const keys = await deriveKeys(piiKey);
    const emailHash = await hmac(email.toLowerCase(), keys.hmacKey);
    const emailEncrypted = await encrypt(email.toLowerCase(), keys.encKey);
    const phoneEncrypted = phone ? await encrypt(phone, keys.encKey) : null;

    // 4. Insert into D1 (UNIQUE constraint on email_hash handles dupes)
    const referralCode = generateReferralCode();
    const referredBy = data.referredBy?.trim().toUpperCase() || null;

    try {
      await db
        .prepare(
          `INSERT INTO PlaytestSignups (referral_source, referral_detail, messaging_app, referral_code, referred_by, email_encrypted, phone_encrypted, email_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          referralSource,
          referralDetail || null,
          messagingApp || null,
          referralCode,
          referredBy,
          emailEncrypted,
          phoneEncrypted,
          emailHash,
        )
        .run();
    } catch (err: any) {
      // UNIQUE constraint violation = already signed up
      if (err?.message?.includes('UNIQUE')) {
        const existing = await db
          .prepare('SELECT referral_code FROM PlaytestSignups WHERE email_hash = ?')
          .bind(emailHash)
          .first<{ referral_code: string | null }>();

        let code = existing?.referral_code;
        if (!code) {
          code = referralCode;
          await db
            .prepare('UPDATE PlaytestSignups SET referral_code = ? WHERE email_hash = ?')
            .bind(code, emailHash)
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

      // 6. Upsert to Resend Contacts (with segment for segmentation)
      const segmentId = env.RESEND_PLAYTEST_SEGMENT_ID as string | undefined;
      if (segmentId) {
        const resend = new Resend(resendApiKey);
        const { error: contactErr } = await resend.contacts.create({
          email: email.toLowerCase(),
          unsubscribed: false,
          segments: [{ id: segmentId }],
        });
        if (contactErr) {
          console.error('[Playtest] Contact upsert failed:', contactErr);
        }
      }
    }

    return { success: true, referralCode };
  } catch (err: any) {
    console.error('[Playtest] Signup error:', err);
    return { error: 'Something went wrong. Please try again.' };
  }
}
