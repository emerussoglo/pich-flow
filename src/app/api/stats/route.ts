import { NextRequest, NextResponse } from 'next/server';
import { GET as getOverview } from './overview/route';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return getOverview(request);
}

