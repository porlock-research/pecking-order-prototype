import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getEnv } from "@/lib/db";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f0a1a",
};

const SITE_TITLE = "Pecking Order";
const SITE_DESCRIPTION =
  "A social game of alliances, betrayal, and strategy. Your friends are your rivals.";

// `generateMetadata` (instead of the static `metadata` export) so we can read
// LOBBY_HOST from the Cloudflare env and emit absolute og:image / og:url.
// Without absolute URLs, iMessage / Slack / Discord unfurlers ignore the image.
// `metadataBase` also lets Next resolve relative URLs in metadata consistently
// — without it, og:url on sub-pages (/join/CODE, /game/CODE/waiting) won't
// include the host.
// `/og-playtest.png` in apps/lobby/public is the existing 1200x630 share card
// ("JOIN THE PECKING ORDER" with persona portraits) — generic enough to reuse
// for all share surfaces. Swap in a dedicated /og-share.png later if the
// message needs to be different for invite-link shares vs playtest funnel.
export async function generateMetadata(): Promise<Metadata> {
  const env = await getEnv();
  const lobbyHost = (env.LOBBY_HOST as string) || "https://lobby.peckingorder.ca";
  const ogImage = `${lobbyHost}/og-playtest.png`;

  return {
    metadataBase: new URL(lobbyHost),
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    openGraph: {
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      url: lobbyHost,
      siteName: SITE_TITLE,
      images: [{ url: ogImage, width: 1200, height: 630, alt: SITE_TITLE }],
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: [ogImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
