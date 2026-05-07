import type { MetadataRoute } from 'next';
import { getEnv } from '@/lib/db';

// Public surfaces only. Token-protected routes (/j/[code], /invite/[token],
// /game/[id], etc.) are personalized and shouldn't appear in a sitemap.
// Uses MARKETING_HOST (apex) so search engines index the canonical
// peckingorder.ca URLs, not the lobby.peckingorder.ca subdomain.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const env = await getEnv();
  const host = (env.MARKETING_HOST as string) || 'https://peckingorder.ca';
  const now = new Date();

  return [
    {
      url: `${host}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${host}/casting`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${host}/how-it-works`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${host}/playtest`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${host}/privacy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${host}/terms`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];
}
