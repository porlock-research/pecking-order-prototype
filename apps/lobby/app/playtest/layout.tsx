import type { Metadata, Viewport } from 'next';
import { getEnv } from '@/lib/db';

const FALLBACK_TITLE = 'Pecking Order — Join the Playtest';
const FALLBACK_DESCRIPTION =
  'Vote. Ally. Betray. Survive. Multi-day social deduction, played from your phone. Reserve your seat in the next playtest.';

// Browser-chrome themeColor — matches the new lobby ink ground (--po-bg-deep
// in [data-theme="reality-tv-tabloid"]). Same value as the root lobby layout
// post-redesign; the per-route override predates the unified palette and is
// kept only so iOS/Android status-bar tinting matches when navigation hops
// across layouts.
export const viewport: Viewport = {
  themeColor: '#0a0a0a',
};

export async function generateMetadata(): Promise<Metadata> {
  const env = await getEnv();
  // Marketing host for canonical URL + OG. Keep a fallback to apex so local
  // dev / preview builds without MARKETING_HOST set still emit valid metadata.
  const host = (env.MARKETING_HOST as string) || 'https://peckingorder.ca';
  const playtestUrl = `${host}/playtest`;
  const ogImage = `${host}/og-playtest.png`;

  return {
    metadataBase: new URL(host),
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
