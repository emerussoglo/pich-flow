import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Ce fournisseur de paiement n’est plus pris en charge.' },
    { status: 410 },
  );
}
