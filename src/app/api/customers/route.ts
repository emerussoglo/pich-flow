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

    const db = getDb();
    let sql = 'SELECT * FROM customers WHERE user_id = ?';
    const args: any[] = [user.id];

    if (applicationId.trim()) {
      sql += ' AND application_id = ?';
      args.push(applicationId.trim());
    }

    sql += ' ORDER BY created_at DESC';
    const result = await db.execute({ sql, args });

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

    const cleanEmail = String(email).toLowerCase().trim();
    const cleanName = String(name).trim();
    const id = `cust_${Date.now()}`;
    const now = new Date().toISOString();

    const db = getDb();
    await db.execute({
      sql: `INSERT INTO customers (id, user_id, application_id, name, email, phone, country, payment_count, total_spent, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
      args: [
        id,
        user.id,
        applicationId || 'app_default',
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

