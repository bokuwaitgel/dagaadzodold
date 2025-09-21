import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    const file = path.join(process.cwd(), 'public', 'followers-instagram.json');
    const data = await fs.readFile(file, 'utf8');
    const arr = JSON.parse(data);
    // Return as-is to the client
    return NextResponse.json(arr);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
