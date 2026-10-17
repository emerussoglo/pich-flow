import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Ce flux de reprise a été retiré. Créez une nouvelle session avec une nouvelle clé Idempotency-Key.',
    },
    { status: 410 },
  );
}
