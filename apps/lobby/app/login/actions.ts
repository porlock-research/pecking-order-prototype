'use server';

import { sendMagicLink } from '@/lib/auth';

export async function requestMagicLink(
  email: string,
  _next: string
): Promise<{ link?: string; error?: string }> {
  if (!email || !email.includes('@')) {
    return { error: 'Please enter a valid email address' };
  }

  try {
    const { link } = await sendMagicLink(email);
    return { link };
  } catch (err: any) {
    console.error('[Login] Magic link error:', err);
    return { error: 'Failed to generate login link. Please try again.' };
  }
}
