import type { MetadataRoute } from 'next';
import { getEnv } from '@/lib/db';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const env = await getEnv();
  const host = (env.MARKETING_HOST as string) || 'https://peckingorder.ca';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Token-protected user paths (/j/[code], /invite/[token], etc.) aren't
        // crawlable without the token anyway, but admin + internal API are
        // explicitly off-limits.
        disallow: ['/admin/', '/admin', '/api/internal/', '/api/internal'],
      },
    ],
    sitemap: `${host}/sitemap.xml`,
  };
}
