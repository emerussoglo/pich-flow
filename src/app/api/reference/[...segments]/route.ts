import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: 'Les données de pays, réseaux et tarifs fournisseur ne sont pas exposées par l’API actuelle.',
    },
    { status: 410 },
  );
}
