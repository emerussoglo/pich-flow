import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function unavailable() {
  return NextResponse.json(
    { success: false, error: 'Cette route API PichFlow v1 n’est pas disponible.' },
    { status: 404 },
  );
}

export const GET = unavailable;
export const POST = unavailable;
export const PUT = unavailable;
export const PATCH = unavailable;
export const DELETE = unavailable;
