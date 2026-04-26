import type { Metadata, Viewport } from 'next';
import { getEnv } from '@/lib/db';

const FALLBACK_TITLE = 'Pecking Order — Join the Playtest';
const FALLBACK_DESCRIPTION =
  'Vote. Ally. Betray. Survive. A social deduction game in your group chat. Reserve your seat in the next playtest.';

// Distinct magenta for the signup funnel — visually separates the playtest
// onboarding from the in-game `#0f0a1a` palette. Root lobby layout sets
// `#0f0a1a`; this override applies only to the /playtest subtree.
export const viewport: Viewport = {
  themeColor: '#2c003e',
};

export async function generateMetadata(): Promise<Metadata> {
  const env = await getEnv();
  const lobbyHost = (env.LOBBY_HOST as string) || 'https://lobby.peckingorder.ca';
  const playtestUrl = (env.PLAYTEST_URL as string) || `${lobbyHost}/playtest`;
  const ogImage = `${lobbyHost}/og-playtest.png`;

  return {
    metadataBase: new URL(lobbyHost),
    title: FALLBACK_TITLE,
    description: FALLBACK_DESCRIPTION,
    openGraph: {
      title: FALLBACK_TITLE,
      description: FALLBACK_DESCRIPTION,
      url: playtestUrl,
      siteName: 'Pecking Order',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: 'Pecking Order — Join the Playtest',
        },
      ],
      type: 'website',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: FALLBACK_TITLE,
      description: FALLBACK_DESCRIPTION,
      images: [ogImage],
    },
  };
}

export default function PlaytestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
