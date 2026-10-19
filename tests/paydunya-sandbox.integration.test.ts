import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import dotenv from 'dotenv';
import { NextRequest } from 'next/server';

dotenv.config();

const runSandboxIntegration = process.env.PAYDUNYA_SANDBOX_INTEGRATION === '1';

Reflect.set(process.env, 'NODE_ENV', 'test');
process.env.TURSO_DATABASE_URL = 'file::memory:';
process.env.TURSO_AUTH_TOKEN = '';
process.env.APP_URL = 'http://localhost:3000';
delete process.env.NEXT_PUBLIC_APP_URL;
delete process.env.VERCEL_URL;

test('PichFlow creates and verifies a real PayDunya sandbox invoice', {
  skip: !runSandboxIntegration,
}, async () => {
  assert.equal((process.env.PAYDUNYA_MODE || '').trim().toLowerCase(), 'sandbox');

  const { getDb, initDatabase } = await import('../src/server/db');
  const { POST: createPaymentLink } = await import('../src/app/api/payment-links/route');
  const { GET: getPublicPaymentLink } = await import('../src/app/api/payment-links/slug/[slug]/route');
  const { handleApiRequest } = await import('../src/server/adapter');
  const db = getDb();

  try {
    await initDatabase(db);
    const now = new Date().toISOString();
    const userId = `sandbox-user-${randomUUID()}`;
    const applicationId = `sandbox-app-${randomUUID()}`;
    const sessionToken = randomUUID();

    await db.execute({
      sql: `INSERT INTO users (id, email, password_hash, full_name, created_at, updated_at)
            VALUES (?, ?, 'test-only', 'Sandbox Merchant', ?, ?)`,
      args: [userId, `${userId}@example.test`, now, now],
    });
    await db.execute({
      sql: `INSERT INTO applications (id, user_id, name, slug, created_at, updated_at)
            VALUES (?, ?, 'Sandbox Integration', ?, ?, ?)`,
      args: [applicationId, userId, applicationId, now, now],
    });
    await db.execute({
      sql: `INSERT INTO sessions (id, user_id, application_id, token, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        `sandbox-session-${randomUUID()}`,
        userId,
        applicationId,
        sessionToken,
        new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        now,
      ],
    });

    const createdLink = await createPaymentLink(new NextRequest(
      'http://localhost:3000/api/payment-links',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `pf_auth_token=${sessionToken}`,
        },
        body: JSON.stringify({
          applicationId,
          title: 'Sandbox checkout verification',
          amount: 200,
          currency: 'XOF',
          country: 'BJ',
          isFixedAmount: true,
        }),
      },
    ));
    assert.equal(createdLink.status, 200);
    const linkData = await createdLink.json();
    const slug = String(linkData.paymentLink.slug);
    assert.match(String(linkData.paymentLink.paymentUrl), /^http:\/\/localhost:3000\/pay\//);

    const publicLink = await getPublicPaymentLink(
      new NextRequest(`http://localhost:3000/api/payment-links/slug/${slug}`),
      { params: Promise.resolve({ slug }) },
    );
    assert.equal(publicLink.status, 200);

    const idempotencyKey = `sandbox-${randomUUID()}`;
    const initiated = await handleApiRequest(new Request('http://localhost:3000/api/checkout/initiate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({
        paymentLinkId: String(linkData.paymentLink.id),
        paymentLinkSlug: slug,
        firstName: 'Sandbox',
        lastName: 'Customer',
        customerEmail: `customer-${randomUUID()}@example.test`,
        customerPhone: '',
        country: 'BJ',
      }),
    }));
    assert.equal(initiated.status, 200);
    const checkout = await initiated.json();
    assert.equal(checkout.success, true);
    assert.equal(checkout.status, 'pending');
    assert.ok(['app.paydunya.com', 'paydunya.com'].includes(new URL(checkout.invoiceUrl).hostname));

    const statusResponse = await handleApiRequest(
      new Request(`http://localhost:3000/api/checkout/status/${encodeURIComponent(checkout.reference)}`),
    );
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json();
    assert.equal(status.status, 'pending');

    const savedSession = await db.execute({
      sql: `SELECT status, paydunya_token, paydunya_url, application_id, payment_link_id
            FROM checkout_sessions WHERE reference = ?`,
      args: [checkout.reference],
    });
    assert.equal(savedSession.rows.length, 1);
    assert.equal(savedSession.rows[0].status, 'pending');
    assert.ok(savedSession.rows[0].paydunya_token);
    assert.equal(savedSession.rows[0].application_id, applicationId);
    assert.equal(savedSession.rows[0].payment_link_id, linkData.paymentLink.id);
  } finally {
    await db.close();
  }
});
