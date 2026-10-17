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
      sql: 'SELECT * FROM payout_methods WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
      args: [user.id],
    });

    const payoutMethods = result.rows.map((row) => ({
      id: String(row.id),
      type: String(row.type) as 'mobile_money' | 'bank_transfer',
      label: String(row.label || row.recipient_name || 'Méthode'),
      operatorOrBank: String(row.operator_or_bank),
      recipientName: String(row.recipient_name),
      recipientPhoneOrIban: String(row.recipient_phone_or_iban),
      accountNumber: String(row.account_number || ''),
      iban: String(row.iban || ''),
      swiftBic: String(row.swift_bic || ''),
      bankCode: String(row.bank_code || ''),
      branchCode: String(row.branch_code || ''),
      country: String(row.country || 'BJ'),
      currency: String(row.currency || 'XOF'),
      isDefault: Boolean(row.is_default),
      isVerified: false,
      createdAt: String(row.created_at),
    }));

    return NextResponse.json({ success: true, payoutMethods });
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
      type,
      label,
      operatorOrBank,
      recipientName,
      recipientPhoneOrIban,
      accountNumber,
      iban,
      swiftBic,
      bankCode,
      branchCode,
      country,
      currency,
    } = body;

    if (!type || !operatorOrBank) {
      return NextResponse.json({ success: false, error: 'Type de méthode et opérateur/banque requis.' }, { status: 400 });
    }

    const db = getDb();
    const id = `pm_${Date.now()}`;
    const now = new Date().toISOString();

    const countRes = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM payout_methods WHERE user_id = ?',
      args: [user.id],
    });
    const isFirst = Number(countRes.rows[0].count || 0) === 0;

    await db.execute({
      sql: `INSERT INTO payout_methods (id, user_id, type, label, operator_or_bank, recipient_name, recipient_phone_or_iban, account_number, iban, swift_bic, bank_code, branch_code, country, currency, is_default, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        user.id,
        type,
        label || (type === 'mobile_money' ? 'Compte mobile money' : 'Compte bancaire principal'),
        operatorOrBank,
        recipientName || user.full_name,
        recipientPhoneOrIban || accountNumber || '',
        accountNumber || '',
        iban || '',
        swiftBic || '',
        bankCode || '',
        branchCode || '',
        country || 'BJ',
        currency || 'XOF',
        isFirst ? 1 : 0,
        now,
      ],
    });

    return NextResponse.json({
      success: true,
      payoutMethod: {
        id,
        type,
        label: label || (type === 'mobile_money' ? 'Compte mobile money' : 'Compte bancaire principal'),
        operatorOrBank,
        recipientName: recipientName || user.full_name,
        recipientPhoneOrIban: recipientPhoneOrIban || accountNumber || '',
        accountNumber,
        iban,
        swiftBic,
        bankCode,
        branchCode,
        country: country || 'BJ',
        currency: currency || 'XOF',
        isDefault: isFirst,
        isVerified: false,
        createdAt: now,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
