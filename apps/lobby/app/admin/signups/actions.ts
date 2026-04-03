'use server';

import { getDB, getEnv } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/super-admin';
import { deriveKeys, decrypt } from '@/lib/crypto';

export interface SignupRow {
  id: number;
  email: string | null;
  phone: string | null;
  messagingApp: string | null;
  referralSource: string;
  referralDetail: string | null;
  referredBy: string | null;
  referralCode: string | null;
  signedUpAt: string;
}

export interface SignupsResult {
  rows: SignupRow[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 50;

export async function listSignups(page = 1): Promise<SignupsResult> {
  await requireSuperAdmin();

  console.log(`[Admin] Signups viewed at ${new Date().toISOString()}`);

  const db = await getDB();
  const env = await getEnv();
  const piiKey = env.PII_ENCRYPTION_KEY as string | undefined;

  const offset = (page - 1) * PAGE_SIZE;

  const [countResult, dataResult] = await Promise.all([
    db.prepare('SELECT COUNT(*) as total FROM PlaytestSignups').first<{ total: number }>(),
    db
      .prepare(
        `SELECT id, email, email_encrypted, phone, phone_encrypted, messaging_app,
                referral_source, referral_detail, referred_by, referral_code, signed_up_at
         FROM PlaytestSignups
         ORDER BY id DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(PAGE_SIZE, offset)
      .all<{
        id: number;
        email: string | null;
        email_encrypted: string | null;
        phone: string | null;
        phone_encrypted: string | null;
        messaging_app: string | null;
        referral_source: string;
        referral_detail: string | null;
        referred_by: string | null;
        referral_code: string | null;
        signed_up_at: string;
      }>(),
  ]);

  const total = countResult?.total ?? 0;
  const keys = piiKey ? await deriveKeys(piiKey) : null;

  const rows: SignupRow[] = await Promise.all(
    dataResult.results.map(async (r) => {
      let email = r.email;
      let phone = r.phone;

      if (keys) {
        if (r.email_encrypted) {
          email = await decrypt(r.email_encrypted, keys.encKey);
        }
        if (r.phone_encrypted) {
          phone = await decrypt(r.phone_encrypted, keys.encKey);
        }
      }

      return {
        id: r.id,
        email,
        phone,
        messagingApp: r.messaging_app,
        referralSource: r.referral_source,
        referralDetail: r.referral_detail,
        referredBy: r.referred_by,
        referralCode: r.referral_code,
        signedUpAt: r.signed_up_at,
      };
    }),
  );

  return { rows, total, page, pageSize: PAGE_SIZE };
}
