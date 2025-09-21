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
    const { searchParams } = new URL(req.url);
    const target = searchParams.get('url');
    if (!target) return NextResponse.json({ error: 'Missing url' }, { status: 400 });
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
      // Return a 1x1 transparent PNG if all attempts fail
      const transparentPng = Uint8Array.from([
        137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,0,0,31,21,196,137,0,0,0,10,73,68,65,84,120,156,99,248,15,4,0,9,251,3,253,42,94,171,165,0,0,0,0,73,69,78,68,174,66,96,130
      ]);
      return new Response(transparentPng, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=60',
          'Access-Control-Allow-Origin': '*',
          'Cross-Origin-Resource-Policy': 'cross-origin',
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
