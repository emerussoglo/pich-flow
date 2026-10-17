import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyError, authenticateApiKey } from '@/src/server/api-key';
import { ensureDatabaseInitialized, getDb } from '@/src/server/db';

export const runtime = 'nodejs';

function apiError(error: unknown) {
  const status = error instanceof ApiKeyError ? error.statusCode : 500;
  const message = error instanceof Error ? error.message : 'Erreur interne de l’API.';
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const key = await authenticateApiKey(request, 'payin');
    await ensureDatabaseInitialized();
    const result = await getDb().execute({
      sql: `SELECT id, slug, title, description, amount, is_fixed_amount,
                   currency, country, status, usage_count, usage_limit, created_at
            FROM payment_links
            WHERE user_id = ? AND application_id = ?
            ORDER BY created_at DESC`,
      args: [key.userId, key.applicationId],
    });
    return NextResponse.json({
      success: true,
      data: result.rows.map((row) => ({
        id: String(row.id),
        slug: String(row.slug),
        title: String(row.title),
        description: String(row.description || ''),
        amount: row.amount === null ? null : Number(row.amount),
        isFixedAmount: Boolean(row.is_fixed_amount),
        currency: String(row.currency),
        country: String(row.country || 'BJ'),
        status: String(row.status),
        usageCount: Number(row.usage_count || 0),
        usageLimit: row.usage_limit === null ? null : Number(row.usage_limit),
        createdAt: String(row.created_at),
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const key = await authenticateApiKey(request, 'payin');
    await ensureDatabaseInitialized();
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Requête JSON invalide.' }, { status: 400 });
    }
    const values = body as Record<string, unknown>;
    const title = typeof values.name === 'string'
      ? values.name.trim()
      : typeof values.title === 'string' ? values.title.trim() : '';
    const description = typeof values.description === 'string' ? values.description.trim() : '';
    if (values.type !== undefined && values.type !== 'fixed' && values.type !== 'free') {
      return NextResponse.json({ success: false, error: 'type doit valoir fixed ou free.' }, { status: 400 });
    }
    const isFixedAmount = values.type
      ? values.type === 'fixed'
      : values.isFixedAmount !== false;
    const amount = Number(values.amount);
    const currency = typeof values.currency === 'string' ? values.currency.toUpperCase() : 'XOF';

    if (!title || title.length > 160 || description.length > 1000) {
      return NextResponse.json({ success: false, error: 'Nom valide et description de 1000 caractères maximum requis.' }, { status: 400 });
    }
    if (currency !== 'XOF') {
      return NextResponse.json({ success: false, error: 'La configuration PayDunya actuelle prend en charge XOF uniquement.' }, { status: 400 });
    }
    if (isFixedAmount && (!Number.isSafeInteger(amount) || amount <= 0)) {
      return NextResponse.json({ success: false, error: 'Le montant fixe doit être un entier positif en XOF.' }, { status: 400 });
    }
    if (!isFixedAmount && values.amount !== undefined && values.amount !== null) {
      return NextResponse.json({ success: false, error: 'Un lien à montant libre ne doit pas inclure de montant prédéfini.' }, { status: 400 });
    }

    const db = getDb();
    const id = `pl_${crypto.randomUUID()}`;
    const slug = `pl-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 30)}-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();
    const usageLimit = values.usageLimit === undefined || values.usageLimit === null
      ? null
      : Number(values.usageLimit);
    if (usageLimit !== null && (!Number.isSafeInteger(usageLimit) || usageLimit <= 0)) {
      return NextResponse.json({ success: false, error: 'usageLimit doit être un entier positif.' }, { status: 400 });
    }
    await db.execute({
      sql: `INSERT INTO payment_links
        (id, user_id, application_id, slug, title, description, amount, is_fixed_amount,
         currency, country, status, usage_count, usage_limit, require_phone, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'XOF', 'BJ', 'active', 0, ?, 1, ?, ?)`,
      args: [
        id, key.userId, key.applicationId, slug, title, description,
        isFixedAmount ? amount : null, isFixedAmount ? 1 : 0, usageLimit, now, now,
      ],
    });
    return NextResponse.json({
      success: true,
      data: {
        id,
        slug,
        name: title,
        description,
        type: isFixedAmount ? 'fixed' : 'customer',
        amount: isFixedAmount ? amount : null,
        currency: 'XOF',
        country: 'BJ',
        status: 'active',
        createdAt: now,
      },
    }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
