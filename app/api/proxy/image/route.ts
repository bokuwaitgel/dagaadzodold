export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

const ALLOWED_HOSTS = [
  'fbcdn.net',
  'fna.fbcdn.net',
  'instagram.com',
  'cdninstagram.com',
  'picsum.photos',
];

function isAllowed(urlStr: string) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOSTS.some((h) => host.endsWith(h) || host.includes('instagram.'));
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  try {
    const thisUrl = new URL(req.url);
    const { searchParams } = thisUrl;
  const targetParam = searchParams.get('url');
  if (!targetParam) return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  let target: string = targetParam;
    // Unwrap nested proxy URLs like /api/proxy/image?url=<our-origin>/api/proxy/image?url=...
    try {
      let guard = 0;
      while (target && guard < 4) {
        const u: URL = new URL(target, thisUrl.origin); // support relative
        if (u.pathname.replace(/\/$/, '') === '/api/proxy/image') {
          const inner: string | null = u.searchParams.get('url');
          if (inner && inner !== target) { target = inner; guard++; continue; }
        }
        break;
      }
    } catch {}
    // Validate final target host
    if (!isAllowed(target)) return NextResponse.json({ error: 'Host not allowed' }, { status: 400 });

    const makeReq = (u: string) => fetch(u, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FBR/1.0; +https://example.local) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'Referer': 'https://www.instagram.com/',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });

  let upstream = await makeReq(target);
    // Fallback 1: try without query params
    if (!upstream.ok) {
      try {
  const u = new URL(target);
        u.search = '';
        upstream = await makeReq(u.toString());
      } catch {}
    }
    if (!upstream.ok) {
      // Return a visible neutral placeholder (SVG) if all attempts fail
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#232323"/>
      <stop offset="100%" stop-color="#2c2c2c"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" fill="url(#g)"/>
  <circle cx="32" cy="24" r="12" fill="#3a3a3a"/>
  <rect x="12" y="40" width="40" height="16" rx="8" fill="#3a3a3a"/>
  <circle cx="32" cy="24" r="9" fill="#4a4a4a"/>
  <rect x="16" y="42" width="32" height="12" rx="6" fill="#4a4a4a"/>
</svg>`;
      return new Response(svg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=60',
          'Access-Control-Allow-Origin': '*',
          'Cross-Origin-Resource-Policy': 'cross-origin',
          'X-FBR-Proxy-Status': String(upstream.status),
        },
      });
    }
    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
