import { z } from 'zod';

export const REFERRAL_SOURCES = [
  'FRIEND',
  'REDDIT',
  'TWITTER',
  'DISCORD',
  'INSTAGRAM',
  'TIKTOK',
  'YOUTUBE',
  'BLOG',
  'OTHER',
] as const;

export type ReferralSource = (typeof REFERRAL_SOURCES)[number];

export const REFERRAL_LABELS: Record<ReferralSource, string> = {
  FRIEND: 'Friend / word of mouth',
  REDDIT: 'Reddit',
  TWITTER: 'Twitter / X',
  DISCORD: 'Discord',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  YOUTUBE: 'YouTube',
  BLOG: 'Blog / article',
  OTHER: 'Other',
};

export const MESSAGING_APPS = [
  'WHATSAPP',
  'IMESSAGE',
  'DISCORD',
  'TELEGRAM',
  'SIGNAL',
  'OTHER',
] as const;

export type MessagingApp = (typeof MESSAGING_APPS)[number];

export const MESSAGING_LABELS: Record<MessagingApp, string> = {
  WHATSAPP: 'WhatsApp',
  IMESSAGE: 'iMessage',
  DISCORD: 'Discord',
  TELEGRAM: 'Telegram',
  SIGNAL: 'Signal',
  OTHER: 'Other',
};

export const signupSchema = z.object({
  email: z.string().email('Please enter a valid email address').max(254),
  referralSource: z.enum(REFERRAL_SOURCES, {
    errorMap: () => ({ message: 'Please select how you heard about us' }),
  }),
  referralDetail: z
    .string()
    .max(200, 'Maximum 200 characters')
    .transform((s) => s.replace(/<[^>]*>/g, '').trim())
    .optional(),
  phone: z
    .string()
    .max(20)
    .transform((s) => s.replace(/[^0-9+\-() ]/g, '').trim())
    .optional(),
  messagingApp: z.enum(MESSAGING_APPS).optional(),
  referredBy: z
    .string()
    .max(10)
    .regex(/^[A-Z0-9]*$/, 'Invalid referral code')
    .optional(),
  turnstileToken: z.string().min(1, 'Please complete the verification'),
});

export type SignupInput = z.infer<typeof signupSchema>;
