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
      sql: 'SELECT * FROM payout_requests WHERE user_id = ? ORDER BY created_at DESC',
      args: [user.id],
    });

    const withdrawals = result.rows.map((row) => ({
      id: String(row.id),
      reference: String(row.reference),
      amount: Number(row.amount),
      currency: String(row.currency || 'XOF'),
      fee: Number(row.fee || 0),
      netAmount: Number(row.net_amount || row.amount),
      methodType: String(row.method_type) as 'mobile_money' | 'bank_transfer',
      recipientName: String(row.recipient_name),
      recipientPhoneOrIban: String(row.recipient_phone_or_iban),
      operatorOrBank: String(row.operator_or_bank),
      country: String(row.country || 'BJ'),
      status: String(row.status),
      createdAt: String(row.created_at),
      processedAt: row.processed_at ? String(row.processed_at) : undefined,
    }));

    return NextResponse.json({ success: true, withdrawals });
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

    const { amount, currency, methodType, recipientName, recipientPhoneOrIban, operatorOrBank, country } = body;
    if (!amount || amount <= 0 || !recipientName || !recipientPhoneOrIban) {
      return NextResponse.json({ success: false, error: 'Montant, bénéficiaire et coordonnées requis.' }, { status: 400 });
    }

    const numAmount = Number(amount);
    const db = getDb();

    // Verify wallet balance
    const walletRes = await db.execute({
      sql: 'SELECT * FROM wallets WHERE user_id = ? AND currency = ?',
      args: [user.id, currency || 'XOF'],
    });

    if (walletRes.rows.length === 0 || Number(walletRes.rows[0].balance) < numAmount) {
      return NextResponse.json({ success: false, error: 'Solde insuffisant pour effectuer ce retrait.' }, { status: 400 });
    }

    const wallet = walletRes.rows[0];
    const fee = Math.round(numAmount * 0.01); // 1% payout fee
    const netAmount = numAmount - fee;
    const now = new Date().toISOString();
    const reference = `WDR-PF-${Date.now().toString().slice(-6)}`;
    const id = `wdr_${Date.now()}`;

    // Deduct balance
    await db.execute({
      sql: 'UPDATE wallets SET balance = balance - ?, updated_at = ? WHERE id = ?',
      args: [numAmount, now, wallet.id],
    });

    await db.execute({
      sql: `INSERT INTO payout_requests (id, user_id, reference, amount, currency, fee, net_amount, method_type, recipient_name, recipient_phone_or_iban, operator_or_bank, country, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)`,
      args: [
        id,
        user.id,
        reference,
        numAmount,
        currency || 'XOF',
        fee,
        netAmount,
        methodType || 'mobile_money',
        recipientName,
        recipientPhoneOrIban,
        operatorOrBank || 'MTN',
        country || 'BJ',
        now,
      ],
    });

    return NextResponse.json({
      success: true,
      withdrawal: {
        id,
        reference,
        amount: numAmount,
        currency: currency || 'XOF',
        fee,
        netAmount,
        methodType: methodType || 'mobile_money',
        recipientName,
        recipientPhoneOrIban,
        operatorOrBank: operatorOrBank || 'MTN',
        country: country || 'BJ',
        status: 'completed',
        createdAt: now,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

