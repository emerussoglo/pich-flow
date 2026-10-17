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

    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get('applicationId') || searchParams.get('appId') || '';
    if (!applicationId.trim()) {
      return NextResponse.json({ success: false, error: 'Application requise.' }, { status: 400 });
    }

    const db = getDb();
    const application = await db.execute({
      sql: 'SELECT id FROM applications WHERE id = ? AND user_id = ?',
      args: [applicationId.trim(), user.id],
    });
    if (application.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }

    const result = await db.execute({
      sql: `SELECT * FROM customers
            WHERE user_id = ? AND application_id = ?
            ORDER BY created_at DESC`,
      args: [user.id, applicationId.trim()],
    });

    const customers = result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      phone: String(row.phone || ''),
      country: String(row.country || 'BJ'),
      paymentCount: Number(row.payment_count || 0),
      totalSpent: Number(row.total_spent || 0),
      createdAt: String(row.created_at),
      lastTransactionAt: row.last_transaction_at ? String(row.last_transaction_at) : undefined,
    }));

    return NextResponse.json({ success: true, customers });
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

    const { name, email, phone, country, applicationId } = body;
    if (!name || !email) {
      return NextResponse.json({ success: false, error: 'Nom et adresse email requis.' }, { status: 400 });
    }
    if (typeof applicationId !== 'string' || !applicationId.trim()) {
      return NextResponse.json({ success: false, error: 'applicationId requis.' }, { status: 400 });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const cleanName = String(name).trim();
    const id = `cust_${randomUUID()}`;
    const now = new Date().toISOString();

    const db = getDb();
    const app = await db.execute({
      sql: 'SELECT id FROM applications WHERE id = ? AND user_id = ?',
      args: [applicationId, user.id],
    });
    if (app.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }
    await db.execute({
      sql: `INSERT INTO customers
        (id, user_id, application_id, name, email, phone, country, payment_count,
         total_spent, currency, last_transaction_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 'XOF', ?, ?)`,
      args: [
        id,
        user.id,
        applicationId,
        cleanName,
        cleanEmail,
        phone || '',
        country || 'BJ',
        now,
        now,
      ],
    });

    return NextResponse.json({
      success: true,
      customer: {
        id,
        name: cleanName,
        email: cleanEmail,
        phone: phone || '',
        country: country || 'BJ',
        paymentCount: 0,
        totalSpent: 0,
        createdAt: now,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
