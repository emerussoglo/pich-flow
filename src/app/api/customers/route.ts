import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';
import { getAuthUserFromRequest, userHasSelectedApplication } from '@/src/server/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get('applicationId') || searchParams.get('appId') || '';
    if (!await userHasSelectedApplication(user, applicationId)) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }

    const db = getDb();
    const result = await db.execute({
      sql: `SELECT c.*,
              t.reference AS last_transaction_reference,
              t.amount AS last_transaction_amount,
              t.currency AS last_transaction_currency,
              t.status AS last_transaction_status,
              t.created_at AS last_transaction_date,
              pl.title AS last_payment_link_title
            FROM customers c
            LEFT JOIN transactions t ON t.id = (
              SELECT latest.id FROM transactions latest
              WHERE latest.user_id = c.user_id
                AND latest.application_id = c.application_id
                AND lower(latest.customer_email) = lower(c.email)
              ORDER BY latest.created_at DESC LIMIT 1
            )
            LEFT JOIN checkout_sessions cs
              ON cs.reference = t.reference AND cs.application_id = c.application_id
            LEFT JOIN payment_links pl
              ON pl.id = cs.payment_link_id AND pl.application_id = c.application_id
            WHERE c.user_id = ? AND c.application_id = ?
            ORDER BY c.created_at DESC`,
      args: [user.id, applicationId],
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
      lastTransaction: row.last_transaction_reference ? {
        reference: String(row.last_transaction_reference),
        amount: Number(row.last_transaction_amount),
        currency: String(row.last_transaction_currency || 'XOF'),
        status: String(row.last_transaction_status),
        createdAt: String(row.last_transaction_date),
        paymentLinkTitle: row.last_payment_link_title ? String(row.last_payment_link_title) : undefined,
      } : undefined,
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
    if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ success: false, error: 'Nom et adresse email requis.' }, { status: 400 });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const cleanName = String(name).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json({ success: false, error: 'Adresse email invalide.' }, { status: 400 });
    }
    if (typeof applicationId !== 'string' || !await userHasSelectedApplication(user, applicationId)) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }
    const id = `cust_${Date.now()}`;
    const now = new Date().toISOString();

    const db = getDb();
    const existing = await db.execute({
      sql: 'SELECT * FROM customers WHERE user_id = ? AND application_id = ? AND lower(email) = ? LIMIT 1',
      args: [user.id, applicationId, cleanEmail],
    });
    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      await db.execute({
        sql: 'UPDATE customers SET name = ?, phone = ?, country = ? WHERE id = ? AND user_id = ? AND application_id = ?',
        args: [cleanName, phone || '', country || 'BJ', row.id, user.id, applicationId],
      });
      return NextResponse.json({
        success: true,
        customer: {
          id: String(row.id), name: cleanName, email: cleanEmail, phone: phone || '',
          country: country || 'BJ', paymentCount: Number(row.payment_count || 0),
          totalSpent: Number(row.total_spent || 0), createdAt: String(row.created_at),
        },
      });
    }

    await db.execute({
      sql: `INSERT INTO customers
            (id, user_id, application_id, name, email, phone, country, payment_count, total_spent, currency, last_transaction_at, created_at)
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
