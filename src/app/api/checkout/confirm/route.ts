import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'La confirmation directe a été retirée. Le statut est vérifié côté serveur auprès de PayDunya.',
    },
    { status: 410 },
  );
}
