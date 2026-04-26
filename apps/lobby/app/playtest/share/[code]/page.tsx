import type { Metadata } from 'next';
import { getEnv } from '@/lib/db';
import { SharePageClient } from './client';

// Referral-link unfurl. The recruit just signed up and is sharing this URL
// to bring more people in — every share should sell the show, not look
// like generic site chrome.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const env = await getEnv();
  const lobbyHost = (env.LOBBY_HOST as string) || 'https://lobby.peckingorder.ca';
  const playtestUrl = (env.PLAYTEST_URL as string) || `${lobbyHost}/playtest`;
  const ogImage = `${lobbyHost}/og-playtest.png`;
  const url = `${playtestUrl}/share/${code.toUpperCase()}`;

  const title = "You're on the list — bring your people";
  const description = 'Vote. Ally. Betray. Survive. The next Pecking Order playtest is forming. Reserve your seat.';

  return {
    metadataBase: new URL(lobbyHost),
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'Pecking Order',
      images: [{ url: ogImage, width: 1200, height: 630, alt: 'Pecking Order — Vote. Ally. Betray. Survive.' }],
      type: 'website',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const [{ code }, env] = await Promise.all([params, getEnv()]);
  const lobbyHost = (env.LOBBY_HOST as string) || '';
  const playtestUrl = (env.PLAYTEST_URL as string) || `${lobbyHost}/playtest`;

  return <SharePageClient code={code} playtestUrl={playtestUrl} />;
}
