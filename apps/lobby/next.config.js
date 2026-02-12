/** @type {import('next').NextConfig} */

// In dev mode, bridge Cloudflare bindings (D1, vars) into the Next.js process
// so that getCloudflareContext() works with `next dev`.
if (process.env.NODE_ENV === 'development') {
  const { initOpenNextCloudflareForDev } =
    require('@opennextjs/cloudflare');
  initOpenNextCloudflareForDev();
}

const nextConfig = {};

module.exports = nextConfig;
