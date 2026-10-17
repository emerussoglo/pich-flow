import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/src/server/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
  }
  return NextResponse.json(
    { success: false, error: 'Les transferts internes ne sont pas encore pris en charge.' },
    { status: 501 },
  );
}
