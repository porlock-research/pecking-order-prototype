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
  referredBy: z
    .string()
    .max(10)
    .regex(/^[A-Z0-9]*$/, 'Invalid referral code')
    .optional(),
  turnstileToken: z.string().min(1, 'Please complete the verification'),
});

export type SignupInput = z.infer<typeof signupSchema>;
