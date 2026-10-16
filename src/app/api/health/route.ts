import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'PichFlow Payment Core',
    framework: 'Next.js App Router',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
}

