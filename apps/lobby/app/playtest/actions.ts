'use server';

import { getDB, getEnv } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { buildPlaytestConfirmationEmail } from '@/lib/email-templates';
import { deriveKeys, encrypt, hmac } from '@/lib/crypto';
import { log } from '@/lib/log';
import { signupSchema, optionalUpdateSchema } from './constants';
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
  referralSource?: string;
  referralDetail?: string;
  phone?: string;
  messagingApp?: string;
  referredBy?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  turnstileToken: string;
}): Promise<{ success?: boolean; referralCode?: string; error?: string }> {
  return submitPlaytestSignup(data);
}

async function submitPlaytestSignup(
  data: {
    email: string;
    referralSource?: string;
    referralDetail?: string;
    phone?: string;
    messagingApp?: string;
    referredBy?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    turnstileToken: string;
  },
): Promise<{ success?: boolean; referralCode?: string; error?: string }> {
  // 1. Validate input
  const parsed = signupSchema.safeParse(data);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message || 'Invalid input';
    return { error: firstError };
  }

  const {
    email,
    referralSource,
    referralDetail,
    phone,
    messagingApp,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    turnstileToken,
  } = parsed.data;

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
          `INSERT INTO PlaytestSignups (referral_source, referral_detail, messaging_app, referral_code, referred_by, email_encrypted, phone_encrypted, email_hash, utm_source, utm_medium, utm_campaign, utm_content)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          referralSource ?? 'UNKNOWN',
          referralDetail || null,
          messagingApp || null,
          referralCode,
          referredBy,
          emailEncrypted,
          phoneEncrypted,
          emailHash,
          utm_source ?? null,
          utm_medium ?? null,
          utm_campaign ?? null,
          utm_content ?? null,
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
        log('info', 'playtest', 'signup_duplicate', {
          email_hash_prefix: emailHash.slice(0, 16),
          referral_code: code,
        });
        return { success: true, referralCode: code };
      }
      throw err;
    }

    log('info', 'playtest', 'signup_completed', {
      referral_source: referralSource ?? 'UNKNOWN',
      referred_by: referredBy ?? null,
      utm_source: utm_source ?? null,
      utm_medium: utm_medium ?? null,
      utm_campaign: utm_campaign ?? null,
      utm_content: utm_content ?? null,
      email_hash_prefix: emailHash.slice(0, 16),
      referral_code: referralCode,
    });

    // 5. Send confirmation email
    const resendApiKey = env.RESEND_API_KEY as string | undefined;
    if (resendApiKey) {
      const assetsUrl = (env.PERSONA_ASSETS_URL as string) || '';
      const lobbyUrl = (env.LOBBY_HOST as string) || '';
      const playtestUrl = (env.PLAYTEST_URL as string) || 'https://playtest.peckingorder.ca';

      const { subject, html } = buildPlaytestConfirmationEmail({ assetsUrl, lobbyUrl, playtestUrl, referralCode });
      await sendEmail(email, subject, html, resendApiKey);

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

/**
 * Update optional fields (phone, messaging app, referral source/detail) for an
 * already-signed-up row. Authenticated by matching email_hash + referral_code.
 *
 * NULL values for individual fields mean "skip this field" — existing values
 * are preserved via COALESCE. To avoid overwriting an existing meaningful
 * referral_source (e.g. 'REDDIT' from UTM capture) with the user's later
 * 'UNKNOWN' choice, callers should send referralSource only when explicitly set.
 */
export async function updatePlaytestOptionalFields(data: {
  email: string;
  referralCode: string;
  phone?: string;
  messagingApp?: string;
  referralSource?: string;
  referralDetail?: string;
}): Promise<{ success?: boolean; error?: string }> {
  const parsed = optionalUpdateSchema.safeParse(data);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message || 'Invalid input';
    return { error: firstError };
  }

  const { email, referralCode, phone, messagingApp, referralSource, referralDetail } = parsed.data;

  try {
    const env = await getEnv();
    const db = await getDB();
    const piiKey = env.PII_ENCRYPTION_KEY as string | undefined;
    if (!piiKey) {
      throw new Error('PII_ENCRYPTION_KEY is required');
    }

    const keys = await deriveKeys(piiKey);
    const emailHash = await hmac(email.toLowerCase(), keys.hmacKey);

    const row = await db
      .prepare('SELECT id, referral_code FROM PlaytestSignups WHERE email_hash = ?')
      .bind(emailHash)
      .first<{ id: number; referral_code: string | null }>();

    if (!row) {
      return { error: 'Signup not found' };
    }
    if (row.referral_code !== referralCode) {
      return { error: 'Verification failed' };
    }

    const phoneEncrypted = phone ? await encrypt(phone, keys.encKey) : null;

    await db
      .prepare(
        `UPDATE PlaytestSignups
         SET phone_encrypted = COALESCE(?, phone_encrypted),
             messaging_app   = COALESCE(?, messaging_app),
             referral_source = COALESCE(?, referral_source),
             referral_detail = COALESCE(?, referral_detail)
         WHERE id = ?`,
      )
      .bind(
        phoneEncrypted,
        messagingApp ?? null,
        referralSource ?? null,
        referralDetail ?? null,
        row.id,
      )
      .run();

    return { success: true };
  } catch (err: any) {
    console.error('[Playtest] Optional update error:', err);
    return { error: 'Something went wrong. Please try again.' };
  }
}
