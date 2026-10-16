import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';
import { getAuthUserFromRequest } from '@/src/server/auth';

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
    let body: any;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { name, phone, country } = body;
    const db = getDb();
    await db.execute({
      sql: `UPDATE customers SET name = COALESCE(?, name), phone = COALESCE(?, phone), country = COALESCE(?, country), updated_at = ?
            WHERE id = ? AND user_id = ?`,
      args: [
        name !== undefined ? name : null,
        phone !== undefined ? phone : null,
        country !== undefined ? country : null,
        new Date().toISOString(),
        id,
        user.id,
      ],
    });

    return NextResponse.json({ success: true, message: 'Client mis à jour.' });
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
    const db = getDb();
    await db.execute({
      sql: 'DELETE FROM customers WHERE id = ? AND user_id = ?',
      args: [id, user.id],
    });

    return NextResponse.json({ success: true, message: 'Client supprimé.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

