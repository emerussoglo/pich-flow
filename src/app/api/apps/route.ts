import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';
import { getAuthUserFromRequest } from '@/src/server/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT * FROM applications WHERE user_id = ? ORDER BY created_at DESC',
      args: [user.id],
    });

    const applications = result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      category: String(row.category),
      website: String(row.website || ''),
      environment: String(row.environment || 'test'),
      createdAt: String(row.created_at),
      currency: String(row.currency || 'XOF'),
    }));

    return NextResponse.json({ success: true, applications });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { category, website, currency, environment } = body;
    const name = (body.name || body.appName || body.app_name || body.title || body.label || '').trim();
    if (!name) {
      return NextResponse.json({ success: false, error: 'Le nom de l’application est requis.' }, { status: 400 });
    }

    const id = `app_${randomUUID()}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const now = new Date().toISOString();

    const db = getDb();
    await db.execute({
      sql: `INSERT INTO applications (id, user_id, name, slug, category, website, environment, currency, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        user.id,
        name,
        slug,
        category || 'E-commerce',
        website || '',
        environment || 'test',
        currency || 'XOF',
        'active',
        now,
        now,
      ],
    });

    return NextResponse.json({
      success: true,
      application: {
        id,
        name,
        slug,
        category: category || 'E-commerce',
        website: website || '',
        environment: environment || 'test',
        createdAt: now,
        currency: currency || 'XOF',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
