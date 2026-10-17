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

    const { url, description, events, isActive } = body;
    const db = getDb();
    await db.execute({
      sql: `UPDATE webhooks 
            SET url = COALESCE(?, url),
                description = COALESCE(?, description),
                events = COALESCE(?, events),
                is_active = COALESCE(?, is_active)
            WHERE id = ? AND user_id = ? AND application_id = ?`,
      args: [
        url !== undefined ? url : null,
        description !== undefined ? description : null,
        events !== undefined ? (Array.isArray(events) ? events.join(',') : events) : null,
        isActive !== undefined ? (isActive ? 1 : 0) : null,
        id,
        user.id,
        user.activeApplicationId || '',
      ],
    });

    return NextResponse.json({ success: true, message: 'Webhook mis à jour.' });
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
      sql: 'DELETE FROM webhooks WHERE id = ? AND user_id = ? AND application_id = ?',
      args: [id, user.id, user.activeApplicationId || ''],
    });

    return NextResponse.json({ success: true, message: 'Webhook supprimé.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
