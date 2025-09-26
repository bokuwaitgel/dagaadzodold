export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const fights = await prisma.fight.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    // Normalize leaderboard order by placement for consumers
    const normalized = fights.map((f: any) => {
      const lb = Array.isArray(f.leaderboard) ? [...f.leaderboard] : [];
      // Dedupe by name+username combination (first occurrence wins)
      const seen = new Set<string>();
      const deduped = lb.filter((p: any) => {
        const key = `${(p?.name||'').toLowerCase()}::${(p?.username||'').toLowerCase()}`;
        if (seen.has(key)) return false; seen.add(key); return true;
      });
      let arr = deduped.map((p) => ({ ...p, placement: typeof (p as any)?.placement === 'number' ? (p as any).placement : null }));
      const anyPlacement = arr.some((p) => typeof (p as any).placement === 'number');
      if (anyPlacement) {
        arr.sort((a: any, b: any) => {
          const pa = typeof a.placement === 'number' ? a.placement : Number.POSITIVE_INFINITY;
          const pb = typeof b.placement === 'number' ? b.placement : Number.POSITIVE_INFINITY;
          if (pa !== pb) return pa - pb;
          const k = (b.kills || 0) - (a.kills || 0);
          if (k) return k;
          const d = (b.damageDealt || 0) - (a.damageDealt || 0);
          if (d) return d;
          return String(a.name || '').localeCompare(String(b.name || ''));
        });
  arr = arr.map((p: any, i: number) => ({ ...p, placement: i + 1, place: i + 1, idx: i }));
      } else if (arr.length) {
        // Winner-first fallback when placement missing
        const idx = f.winner ? arr.findIndex((p: any) => (p?.name || null) === f.winner) : -1;
        if (idx > 0) { const [w] = arr.splice(idx, 1); arr.unshift(w); }
  arr = arr.map((p: any, i: number) => ({ ...p, placement: i + 1, place: i + 1, idx: i }));
      }
      return { ...f, leaderboard: arr };
    });
    return NextResponse.json(normalized);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Normalize leaderboard by placement before saving
    let leaderboard: any[] = Array.isArray(body.leaderboard) ? [...body.leaderboard] : [];
    // Dedupe by name+username
    const seen = new Set<string>();
    leaderboard = leaderboard.filter((p: any) => {
      const key = `${(p?.name||'').toLowerCase()}::${(p?.username||'').toLowerCase()}`;
      if (seen.has(key)) return false; seen.add(key); return true;
    });
    const winnerName: string | null = body.winner ?? null;
    // Ensure numeric placement where present
    leaderboard = leaderboard.map((p) => ({ ...p, placement: typeof p?.placement === 'number' ? p.placement : null }));
    const anyPlacement = leaderboard.some((p) => typeof p.placement === 'number');
    if (anyPlacement) {
      leaderboard.sort((a, b) => {
        const pa = typeof a.placement === 'number' ? a.placement : Number.POSITIVE_INFINITY;
        const pb = typeof b.placement === 'number' ? b.placement : Number.POSITIVE_INFINITY;
        if (pa !== pb) return pa - pb;
        // tie-breakers: higher kills, then damage, then name
        const k = (b.kills || 0) - (a.kills || 0);
        if (k) return k;
        const d = (b.damageDealt || 0) - (a.damageDealt || 0);
        if (d) return d;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
      // Enforce winner at place 1 if provided
      if (winnerName) {
        const idx = leaderboard.findIndex((p) => (p?.name || null) === winnerName);
        if (idx > 0) {
          const [w] = leaderboard.splice(idx, 1);
          leaderboard.unshift(w);
        }
      }
  // Reassign compact placements 1..N and add place/idx
  leaderboard = leaderboard.map((p, i) => ({ ...p, placement: i + 1, place: i + 1, idx: i }));
    } else if (leaderboard.length) {
      // No placement provided: if winner present, move to front; else keep order
      if (winnerName) {
        const idx = leaderboard.findIndex((p) => (p?.name || null) === winnerName);
        if (idx > 0) {
          const [w] = leaderboard.splice(idx, 1);
          leaderboard.unshift(w);
        }
      }
  // Assign sequential placement, place and idx
  leaderboard = leaderboard.map((p, i) => ({ ...p, placement: i + 1, place: i + 1, idx: i }));
    }

    const fight = await prisma.fight.create({ data: {
      seed: body.seed ?? null,
      ticks: Number(body.ticks ?? 0),
      winner: body.winner ?? null,
      count: Number(body.count ?? 0),
      user: body.user ?? null,
      leaderboard,
    }});
    return NextResponse.json(fight, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
