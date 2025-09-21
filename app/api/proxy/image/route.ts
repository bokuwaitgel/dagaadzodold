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

    const upstream = await fetch(target, {
      // Revalidate frequently but allow caching
      cache: 'no-store',
      headers: {
        // Some CDNs require a UA
        'User-Agent': 'Mozilla/5.0 (compatible; FBR/1.0; +https://example.local) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        // Optional: try sending a referer that may help IG CDN
        'Referer': 'https://www.instagram.com/',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });
    if (!upstream.ok) return NextResponse.json({ error: `Upstream ${upstream.status}` }, { status: 502 });
    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
