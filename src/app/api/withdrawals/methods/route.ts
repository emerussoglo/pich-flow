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

    const methods = result.rows.map((row) => ({
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
      isVerified: Boolean(row.is_verified || 1),
      createdAt: String(row.created_at),
    }));

    return NextResponse.json({ success: true, payoutMethods: methods, methods });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

