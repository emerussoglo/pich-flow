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

    const { id } = await context.params;
    const db = getDb();
    await db.execute({
      sql: 'DELETE FROM payout_methods WHERE id = ? AND user_id = ?',
      args: [id, user.id],
    });

    return NextResponse.json({ success: true, message: 'Méthode de retrait supprimée.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

