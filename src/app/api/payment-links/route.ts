import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/src/server/db';
import { getAuthUserFromRequest } from '@/src/server/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get('applicationId') || searchParams.get('appId') || '';

    const db = getDb();
    let sql = 'SELECT * FROM payment_links WHERE user_id = ?';
    const args: any[] = [user.id];

    if (applicationId.trim()) {
      sql += ' AND application_id = ?';
      args.push(applicationId.trim());
    }

    sql += ' ORDER BY created_at DESC';
    const result = await db.execute({ sql, args });

    const paymentLinks = result.rows.map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      title: String(row.title),
      description: String(row.description || ''),
      amount: row.amount !== null ? Number(row.amount) : undefined,
      currency: String(row.currency || 'XOF'),
      isFixedAmount: Boolean(row.is_fixed_amount),
      country: String(row.country || 'BJ'),
      redirectUrl: String(row.redirect_url || ''),
      paymentCount: Number(row.payment_count || 0),
      totalCollected: Number(row.total_collected || 0),
      isActive: Boolean(row.is_active),
      createdAt: String(row.created_at),
    }));

    return NextResponse.json({ success: true, paymentLinks });
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

    const {
      title,
      description,
      amount,
      currency,
      isFixedAmount,
      country,
      redirectUrl,
      maxPayments,
      applicationId,
    } = body;

    if (!title) {
      return NextResponse.json({ success: false, error: 'Titre du lien requis.' }, { status: 400 });
    }

    const id = `pl_${Date.now()}`;
    const slug = `pl-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 30)}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();

    const db = getDb();
    await db.execute({
      sql: `INSERT INTO payment_links (
              id, user_id, application_id, slug, title, description, amount, currency, 
              is_fixed_amount, country, redirect_url, max_payments, payment_count, 
              total_collected, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1, ?, ?)`,
      args: [
        id,
        user.id,
        applicationId || 'app_default',
        slug,
        title,
        description || '',
        amount !== undefined && amount !== null ? Number(amount) : null,
        currency || 'XOF',
        isFixedAmount !== false ? 1 : 0,
        country || 'BJ',
        redirectUrl || '',
        maxPayments ? Number(maxPayments) : null,
        now,
        now,
      ],
    });

    const paymentLink = {
      id,
      slug,
      title,
      description: description || '',
      amount: amount !== undefined && amount !== null ? Number(amount) : undefined,
      currency: currency || 'XOF',
      isFixedAmount: isFixedAmount !== false,
      country: country || 'BJ',
      redirectUrl: redirectUrl || '',
      paymentCount: 0,
      totalCollected: 0,
      isActive: true,
      createdAt: now,
    };

    return NextResponse.json({ success: true, paymentLink });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

