import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';
import { getAuthUserFromRequest } from '@/src/server/auth';

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

    const applicationId = request.nextUrl.searchParams.get('applicationId')?.trim();
    if (!applicationId) {
      return NextResponse.json({ success: false, error: 'applicationId requis.' }, { status: 400 });
    }

    const { id } = await context.params;
    const db = getDb();
    const result = await db.execute({
      sql: 'DELETE FROM api_credentials WHERE id = ? AND user_id = ? AND application_id = ?',
      args: [id, user.id, applicationId],
    });
    if (result.rowsAffected === 0) {
      return NextResponse.json({ success: false, error: 'Clé API introuvable.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Clé API révoquée avec succès.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
