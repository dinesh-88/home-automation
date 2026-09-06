/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next's built-in gzip buffers streamed responses, which breaks the SSE
  // endpoint at /api/events. Fine to disable for a LAN homelab app; put a
  // reverse proxy in front if you need compression later.
  compress: false,
};

export default nextConfig;
