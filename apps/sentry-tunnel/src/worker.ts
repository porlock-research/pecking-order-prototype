interface Env {
  SENTRY_HOST: string;
  ALLOWED_PROJECT_IDS: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const body = await request.text();
    const firstLine = body.split('\n')[0];

    let envelope: { dsn?: string };
    try {
      envelope = JSON.parse(firstLine);
    } catch {
      return new Response('Invalid envelope header', { status: 400 });
    }

    if (!envelope.dsn) {
      return new Response('Missing DSN', { status: 400 });
    }

    const projectId = new URL(envelope.dsn).pathname.replace('/', '');
    const allowedIds = env.ALLOWED_PROJECT_IDS.split(',');

    if (!allowedIds.includes(projectId)) {
      return new Response('Invalid project ID', { status: 403 });
    }

    const upstream = `https://${env.SENTRY_HOST}/api/${projectId}/envelope/`;
    const response = await fetch(upstream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      body,
    });

    return new Response(response.body, {
      status: response.status,
      headers: corsHeaders(request),
    });
  },
} satisfies ExportedHandler<Env>;

function corsHeaders(request: Request): HeadersInit {
  return {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'content-type',
  };
}
