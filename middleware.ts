import { rewrite } from '@vercel/edge'

/**
 * Vercel hosts the UI only. Every /api request is proxied to the collector, whose address is the
 * STYX_API_ORIGIN environment variable in the Vercel project (for example https://api.example.com).
 * Browsers only ever talk to Vercel, and the collector's address never enters this repository.
 */
export const config = { matcher: '/api/:path*' }

export default function middleware(request: Request) {
  const origin = process.env.STYX_API_ORIGIN
  if (!origin) return new Response(JSON.stringify({ error: 'STYX_API_ORIGIN is not set on this deployment' }), { status: 503, headers: { 'content-type': 'application/json' } })
  const url = new URL(request.url)
  return rewrite(new URL(url.pathname + url.search, origin))
}
