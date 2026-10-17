import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';
import { getAuthUserFromRequest, userHasSelectedApplication } from '@/src/server/auth';

export const runtime = 'nodejs';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    const { id } = await context.params;
    if (!await userHasSelectedApplication(user, id)) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }
    let body: any;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { name, category, website, currency, environment } = body;
    const db = getDb();
    await db.execute({
      sql: `UPDATE applications SET name = COALESCE(?, name), category = COALESCE(?, category), website = COALESCE(?, website), currency = COALESCE(?, currency), environment = COALESCE(?, environment), updated_at = ?
            WHERE id = ? AND user_id = ?`,
      args: [
        name !== undefined ? name : null,
        category !== undefined ? category : null,
        website !== undefined ? website : null,
        currency !== undefined ? currency : null,
        environment !== undefined ? environment : null,
        new Date().toISOString(),
        id,
        user.id,
      ],
    });

    return NextResponse.json({ success: true, message: 'Application mise à jour.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

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
    if (!await userHasSelectedApplication(user, id)) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }
    const db = getDb();

    // Check if app has transactions
    const txCheck = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM transactions WHERE application_id = ? AND user_id = ?',
      args: [id, user.id],
    });

    const hasTxs = Number(txCheck.rows[0].count || 0) > 0;
    if (hasTxs) {
      await db.execute({
        sql: `UPDATE applications SET status = 'archived', updated_at = ? WHERE id = ? AND user_id = ?`,
        args: [new Date().toISOString(), id, user.id],
      });
      return NextResponse.json({ success: true, message: 'Application archivée (transactions associées existantes).', archived: true });
    } else {
      await db.execute({
        sql: 'DELETE FROM applications WHERE id = ? AND user_id = ?',
        args: [id, user.id],
      });
      return NextResponse.json({ success: true, message: 'Application supprimée.' });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
