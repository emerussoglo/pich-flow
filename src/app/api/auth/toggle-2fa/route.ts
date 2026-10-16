import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';
import { getAuthUserFromRequest } from '@/src/server/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { enable } = body;
    const db = getDb();
    await db.execute({
      sql: 'UPDATE users SET two_factor_enabled = ?, updated_at = ? WHERE id = ?',
      args: [enable ? 1 : 0, new Date().toISOString(), authUser.id],
    });

    return NextResponse.json({ success: true, enabled: Boolean(enable) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

