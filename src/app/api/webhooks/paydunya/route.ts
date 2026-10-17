import { NextRequest, NextResponse } from 'next/server';
import { CheckoutError, handlePayDunyaNotification } from '@/src/server/checkout';

export const runtime = 'nodejs';

function setNestedValue(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.match(/[^[\]]+/g);
  if (!parts?.length) return;
  let current = target;
  for (const part of parts.slice(0, -1)) {
    const next = current[part];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

async function readNotification(request: NextRequest): Promise<Record<string, unknown> | null> {
  const contentType = request.headers.get('content-type')?.toLowerCase() || '';
  if (contentType.includes('application/json')) {
    const body: unknown = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body)
      ? body as Record<string, unknown>
      : null;
  }

  const form = await request.formData();
  const dataField = form.get('data');
  if (typeof dataField === 'string') {
    try {
      const parsed: unknown = JSON.parse(dataField);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { data: parsed };
      }
    } catch {
      return null;
    }
  }

  const body: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (key.startsWith('data[')) setNestedValue(body, key, value);
  }
  return Object.keys(body).length ? body : null;
}

export async function POST(request: NextRequest) {
  try {
    const notification = await readNotification(request);
    if (!notification) {
      return NextResponse.json({ success: false, error: 'Notification invalide.' }, { status: 400 });
    }
    await handlePayDunyaNotification(notification);
    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    const status = error instanceof CheckoutError ? error.statusCode : 503;
    if (!(error instanceof CheckoutError)) {
      console.error('[PayDunya webhook] Notification processing failed.');
    }
    const message = error instanceof Error ? error.message : 'Notification non traitée.';
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
