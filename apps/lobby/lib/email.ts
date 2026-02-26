'use server';

import { Resend } from 'resend';

const FROM_ADDRESS = 'Pecking Order <noreply@peckingorder.game>';

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  apiKey: string,
): Promise<{ success: boolean; error?: string }> {
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
  if (error) return { success: false, error: error.message };
  return { success: true };
}
