import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest, selectActiveApplication } from '@/src/server/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
  }

  let body: { applicationId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Le corps JSON de la requête est invalide.' }, { status: 400 });
  }

  if (typeof body.applicationId !== 'string' || !body.applicationId.trim()) {
    return NextResponse.json({ success: false, error: 'Une application valide est requise.' }, { status: 400 });
  }

  const selected = await selectActiveApplication(request, user.id, body.applicationId);
  if (!selected) {
    return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, applicationId: body.applicationId });
}
