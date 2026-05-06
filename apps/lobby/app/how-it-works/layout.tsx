import type { Metadata, Viewport } from 'next';
import { getEnv } from '@/lib/db';

const TITLE = 'How Pecking Order Works — Multi-Day Social Deduction Game';
const DESCRIPTION =
  'How a multi-day social-deduction game works. Day rhythm, voting mechanics, mini-games, dilemmas, and the catfish format — explained for ORG vets and curious newcomers.';

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
};

export async function generateMetadata(): Promise<Metadata> {
  const env = await getEnv();
  const host = (env.MARKETING_HOST as string) || 'https://peckingorder.ca';
  const url = `${host}/how-it-works`;
  // Reuse the existing 1200x630 share card during initial ship.
  // A dedicated /og-how-it-works.png is a polish-pass follow-up.
  const ogImage = `${host}/og-playtest.png`;

  return {
    metadataBase: new URL(host),
    title: TITLE,
    description: DESCRIPTION,
    applicationName: 'Pecking Order',
    keywords: [
      'social deduction game',
      'multi-day game',
      'async game',
      'phone game',
      'mafia',
      'traitors',
      'survivor ORG',
      'reality game',
      'voting mechanics',
      'how to play pecking order',
    ],
    alternates: { canonical: url },
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      url,
      siteName: 'Pecking Order',
      images: [
        {
          url: ogImage,
          secureUrl: ogImage,
          width: 1200,
          height: 630,
          alt: 'Pecking Order — how the multi-day social-deduction game works',
          type: 'image/png',
        },
      ],
      type: 'website',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: TITLE,
      description: DESCRIPTION,
      images: [ogImage],
    },
  };
}

export default function HowItWorksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
