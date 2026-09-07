import type { NextConfig } from "next";

// Proxying /api/* through this app's own domain (instead of the browser
// calling the backend's origin directly) is what makes Set-Cookie land as a
// first-party cookie for this domain — required for middleware.ts to ever
// see the session cookie when frontend and backend are on unrelated domains
// (e.g. Vercel + Render), since a cross-site Set-Cookie is never visible to
// this app's own server-side cookie reads no matter what SameSite is set to.
const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
