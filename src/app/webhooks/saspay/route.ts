import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Cette route de webhook n’est plus prise en charge.' },
    { status: 410 },
  );
}
