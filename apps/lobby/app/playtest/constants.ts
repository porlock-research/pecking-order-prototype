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
  referralSource: z.enum(REFERRAL_SOURCES).optional(),
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
  utm_source: z
    .string()
    .max(100)
    .transform((s) => s.replace(/<[^>]*>/g, '').trim())
    .optional(),
  utm_medium: z
    .string()
    .max(100)
    .transform((s) => s.replace(/<[^>]*>/g, '').trim())
    .optional(),
  utm_campaign: z
    .string()
    .max(200)
    .transform((s) => s.replace(/<[^>]*>/g, '').trim())
    .optional(),
  utm_content: z
    .string()
    .max(200)
    .transform((s) => s.replace(/<[^>]*>/g, '').trim())
    .optional(),
  turnstileToken: z.string().min(1, 'Please complete the verification'),
});

export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Schema for the post-signup "improve your reminders" form.
 * Authenticated by email_hash + referral_code match (set on the original signup
 * row, returned to the client after submit, and replayed here as a soft proof).
 */
export const optionalUpdateSchema = z.object({
  email: z.string().email('Please enter a valid email address').max(254),
  referralCode: z
    .string()
    .min(1)
    .max(10)
    .regex(/^[A-Z0-9]+$/, 'Invalid referral code'),
  phone: z
    .string()
    .max(20)
    .transform((s) => s.replace(/[^0-9+\-() ]/g, '').trim())
    .optional(),
  messagingApp: z.enum(MESSAGING_APPS).optional(),
  referralSource: z.enum(REFERRAL_SOURCES).optional(),
  referralDetail: z
    .string()
    .max(200, 'Maximum 200 characters')
    .transform((s) => s.replace(/<[^>]*>/g, '').trim())
    .optional(),
});

export type OptionalUpdateInput = z.infer<typeof optionalUpdateSchema>;
