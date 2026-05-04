import type { MetadataRoute } from 'next';
import { getEnv } from '@/lib/db';

// Public surfaces only. Token-protected routes (/j/[code], /invite/[token],
// /game/[id], etc.) are personalized and shouldn't appear in a sitemap.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const env = await getEnv();
  const lobbyHost = (env.LOBBY_HOST as string) || 'https://lobby.peckingorder.ca';
  const now = new Date();

  return [
    {
      url: `${lobbyHost}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${lobbyHost}/playtest`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${lobbyHost}/privacy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${lobbyHost}/terms`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];
}
