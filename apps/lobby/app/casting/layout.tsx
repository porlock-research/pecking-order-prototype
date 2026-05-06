import type { Metadata, Viewport } from 'next';
import { getEnv } from '@/lib/db';

const TITLE = 'Pecking Order — Multi-Day Social Deduction Game';
const DESCRIPTION =
  'A multi-day social-deduction game. Wear a persona, scheme through DMs, vote in real time. New casts always forming. Free during playtest.';
// Title intentionally drops the "Vote. Ally. Betray. Survive." verb stack —
// those live IN the page hero. Title carries searchable keywords ("social
// deduction game") which the verb stack does not. Description still leads
// with the keyword phrase for SERP snippet relevance.

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
};

export async function generateMetadata(): Promise<Metadata> {
  const env = await getEnv();
  // Marketing host (apex). Search engines + social unfurl previews see
  // canonical peckingorder.ca/casting URLs, not the lobby.* subdomain.
  const host = (env.MARKETING_HOST as string) || 'https://peckingorder.ca';
  const url = `${host}/casting`;
  // Reuse the existing 1200x630 share card during initial ship.
  // A dedicated /og-casting.png is a polish-pass follow-up.
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
      'persona game',
      'catfish game',
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
          alt: 'Pecking Order — multi-day social-deduction game cast reveal',
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

export default function CastingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
