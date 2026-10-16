import { NextRequest, NextResponse } from 'next/server';
import { destroySession } from '@/src/server/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    let token = '';

    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    if (!token) {
      token = request.cookies.get('pf_auth_token')?.value || '';
    }

    if (token) {
      await destroySession(token);
    }

    const response = NextResponse.json({ success: true, message: 'Déconnexion réussie.' });
    response.cookies.delete('pf_auth_token');
    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

