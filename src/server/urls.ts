import { isIP } from 'node:net';

function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;

  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    const [first, second] = host.split('.').map(Number);
    return first === 0 || first === 10 || first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168);
  }
  return ipVersion === 6 && (
    host === '::' ||
    host === '::1' ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    /^fe[89ab]/.test(host)
  );
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('APP_URL must use HTTP or HTTPS.');
  }
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    if (url.protocol !== 'https:' || isLocalHost(url.hostname)) {
      throw new Error('APP_URL must be a public HTTPS URL in production.');
    }
  }
  return url.origin + url.pathname.replace(/\/+$/, '');
}

export function getAppBaseUrl(requestOrigin?: string): string {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return normalizeBaseUrl(configured);

  if (process.env.VERCEL_URL) return normalizeBaseUrl(`https://${process.env.VERCEL_URL}`);
  if (requestOrigin) return normalizeBaseUrl(requestOrigin);
  return normalizeBaseUrl('http://localhost:3000');
}

export function getPaymentLinkUrl(slug: string, requestOrigin?: string): string {
  return new URL(`/pay/${encodeURIComponent(slug)}`, `${getAppBaseUrl(requestOrigin)}/`).toString();
}

export function getPayDunyaCallbackUrl(): string {
  const configured = process.env.PAYDUNYA_CALLBACK_URL;
  if (configured) {
    const callbackUrl = new URL(configured);
    if (callbackUrl.protocol !== 'https:' || isLocalHost(callbackUrl.hostname)) {
      throw new Error('PAYDUNYA_CALLBACK_URL must be a publicly reachable HTTPS URL.');
    }
    return callbackUrl.toString();
  }

  const callbackUrl = new URL('/api/webhooks/paydunya', `${getAppBaseUrl()}/`);
  if (isLocalHost(callbackUrl.hostname)) {
    console.warn('[PayDunya] Local callback URL is not reachable from PayDunya. Set PAYDUNYA_CALLBACK_URL to an HTTPS tunnel URL for local callback tests.');
  }
  return callbackUrl.toString();
}
