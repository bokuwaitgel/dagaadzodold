export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const fights = await prisma.fight.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    return NextResponse.json(fights);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const fight = await prisma.fight.create({ data: {
      seed: body.seed ?? null,
      ticks: Number(body.ticks ?? 0),
      winner: body.winner ?? null,
      count: Number(body.count ?? 0),
      user: body.user ?? null,
      leaderboard: body.leaderboard ?? [],
    }});
    return NextResponse.json(fight, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
