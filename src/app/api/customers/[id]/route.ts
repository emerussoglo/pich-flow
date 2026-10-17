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

    const applicationId = new URL(request.url).searchParams.get('applicationId')?.trim();
    if (!applicationId) {
      return NextResponse.json({ success: false, error: 'Application requise.' }, { status: 400 });
    }

    const { id } = await context.params;
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Requête JSON invalide.' }, { status: 400 });
    }

    const values = body as Record<string, unknown>;
    const { name, phone, country } = values;
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return NextResponse.json({ success: false, error: 'Nom invalide.' }, { status: 400 });
    }
    if (phone !== undefined && typeof phone !== 'string') {
      return NextResponse.json({ success: false, error: 'Téléphone invalide.' }, { status: 400 });
    }
    if (country !== undefined && typeof country !== 'string') {
      return NextResponse.json({ success: false, error: 'Pays invalide.' }, { status: 400 });
    }

    const db = getDb();
    const result = await db.execute({
      sql: `UPDATE customers SET name = COALESCE(?, name), phone = COALESCE(?, phone), country = COALESCE(?, country), updated_at = ?
            WHERE id = ? AND user_id = ? AND application_id = ?`,
      args: [
        name === undefined ? null : name.trim(),
        phone === undefined ? null : phone.trim(),
        country === undefined ? null : country.trim(),
        new Date().toISOString(),
        id,
        user.id,
        applicationId,
      ],
    });
    if (result.rowsAffected === 0) {
      return NextResponse.json({ success: false, error: 'Client introuvable.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Client mis à jour.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de mettre à jour le client.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
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

    const applicationId = new URL(request.url).searchParams.get('applicationId')?.trim();
    if (!applicationId) {
      return NextResponse.json({ success: false, error: 'Application requise.' }, { status: 400 });
    }

    const { id } = await context.params;
    const db = getDb();
    const result = await db.execute({
      sql: 'DELETE FROM customers WHERE id = ? AND user_id = ? AND application_id = ?',
      args: [id, user.id, applicationId],
    });
    if (result.rowsAffected === 0) {
      return NextResponse.json({ success: false, error: 'Client introuvable.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Client supprimé.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de supprimer le client.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
