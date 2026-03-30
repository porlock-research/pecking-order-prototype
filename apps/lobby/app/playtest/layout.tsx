import type { Metadata } from 'next';

const PLAYTEST_URL = 'https://playtest.peckingorder.ca';
const TITLE = 'Pecking Order — Join the Playtest';
const DESCRIPTION =
  'A social game of alliances, betrayal & strategy. Sign up to play.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PLAYTEST_URL,
    siteName: 'Pecking Order',
    images: [
      {
        url: `${PLAYTEST_URL}/og-playtest.png`,
        width: 1200,
        height: 630,
        alt: 'Pecking Order — Join the Playtest',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [`${PLAYTEST_URL}/og-playtest.png`],
  },
  other: {
    'theme-color': '#2c003e',
  },
};

export default function PlaytestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
