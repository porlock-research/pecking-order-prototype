import { getEnv } from '@/lib/db';

export const runtime = 'edge';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; file: string }> }
) {
  const { id, file } = await params;

  // Validate the file param (headshot.png, medium.png, full.png)
  const validFiles = ['headshot.png', 'medium.png', 'full.png'];
  if (!validFiles.includes(file)) {
    return new Response('Not found', { status: 404 });
  }

  // Validate the persona ID format
  if (!/^persona-\d+$/.test(id)) {
    return new Response('Not found', { status: 404 });
  }

  const env = await getEnv();

  // If PERSONA_ASSETS_URL is set, redirect to it (CDN/custom domain)
  const assetsUrl = env.PERSONA_ASSETS_URL as string;
  if (assetsUrl) {
    return Response.redirect(`${assetsUrl}/personas/${id}/${file}`, 302);
  }

  // Otherwise serve directly from R2
  const bucket = env.PERSONA_BUCKET as any;
  if (!bucket) {
    return new Response('R2 bucket not configured', { status: 500 });
  }

  const key = `personas/${id}/${file}`;
  const object = await bucket.get(key);

  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'image/png',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800',
    },
  });
}
