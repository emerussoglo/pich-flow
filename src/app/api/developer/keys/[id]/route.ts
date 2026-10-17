import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';
import { getAuthUserFromRequest, userHasSelectedApplication } from '@/src/server/auth';

export const runtime = 'nodejs';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get('applicationId') || searchParams.get('appId') || '';
    if (!await userHasSelectedApplication(user, applicationId)) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }
    const db = getDb();
    const result = await db.execute({
      sql: 'UPDATE api_credentials SET is_active = 0 WHERE id = ? AND user_id = ? AND application_id = ? AND is_active = 1',
      args: [id, user.id, applicationId],
    });
    if (Number(result.rowsAffected) === 0) {
      return NextResponse.json({ success: false, error: 'Clé API introuvable ou déjà révoquée.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Clé API révoquée avec succès.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
