'use server';

import { sendMagicLink } from '@/lib/auth';
import { getEnv } from '@/lib/db';

export async function requestMagicLink(
  email: string,
  next: string
): Promise<{ link?: string; sent?: boolean; error?: string }> {
  if (!email || !email.includes('@')) {
    return { error: 'Please enter a valid email address' };
  }

  try {
    const env = await getEnv();
    const result = await sendMagicLink(email, next, {
      resendApiKey: env.RESEND_API_KEY as string | undefined,
      lobbyHost: env.LOBBY_HOST as string | undefined,
      assetsUrl: env.PERSONA_ASSETS_URL as string | undefined,
    });
    return result;
  } catch (err: any) {
    console.error('[Login] Magic link error:', err);
    return { error: 'Failed to generate login link. Please try again.' };
  }
}
