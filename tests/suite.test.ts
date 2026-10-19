import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  CHECKOUT_COUNTRIES,
  DOCUMENTED_PAYMENT_CHANNELS,
  filterCountriesBySearch,
  SUPPORTED_COUNTRIES,
  SUPPORTED_PAYMENT_CURRENCIES,
} from '../src/config/countries';
import { PRICING_CONFIG } from '../src/config/pricing';
import { PayDunyaService } from '../src/server/paydunya';
import { getAppBaseUrl, getPayDunyaCallbackUrl, getPaymentLinkUrl } from '../src/server/urls';
import { hashPassword, verifyPassword } from '../src/server/auth';

console.log('Running PichFlow offline regression checks...');

const password = 'TestOnly-ValidPassword-456!';
const passwordHash = hashPassword(password);
assert.equal(passwordHash.length, 128);
assert.equal(verifyPassword(password, passwordHash), true);
assert.equal(verifyPassword('incorrect password', passwordHash), false);
assert.equal(PRICING_CONFIG.feeScheduleConfirmed, false);
assert.equal(PRICING_CONFIG.customerSurchargeEnabled, false);
assert.deepEqual(SUPPORTED_COUNTRIES.map((country) => country.code), ['BJ', 'SN', 'CI', 'TG', 'ML', 'BF', 'CM']);
assert.deepEqual(CHECKOUT_COUNTRIES.map((country) => country.code), ['BJ']);
assert.deepEqual(SUPPORTED_COUNTRIES[0].methods, []);
assert.equal(SUPPORTED_COUNTRIES.find((country) => country.code === 'CM')?.currency, 'XAF');
assert.equal(SUPPORTED_COUNTRIES.find((country) => country.code === 'CM')?.methods.find((method) => method.id === 'mtn-cameroun')?.isAvailable, false);
assert.deepEqual(SUPPORTED_PAYMENT_CURRENCIES.map((currency) => currency.code), ['XOF']);
assert.deepEqual(filterCountriesBySearch(CHECKOUT_COUNTRIES, 'benin').map((country) => country.code), ['BJ']);
assert.deepEqual(filterCountriesBySearch(SUPPORTED_COUNTRIES, 'cote d ivoire').map((country) => country.code), ['CI']);
assert.deepEqual(filterCountriesBySearch(CHECKOUT_COUNTRIES, 'cameroun'), []);
assert.deepEqual(
  DOCUMENTED_PAYMENT_CHANNELS.map((method) => method.id).sort(),
  [
    'card', 'orange-money-senegal', 'wave-senegal', 'free-money-senegal', 'expresso-sn',
    'wizall-senegal', 'mtn-benin', 'moov-benin', 'orange-money-ci', 'wave-ci', 'mtn-ci',
    'moov-ci', 't-money-togo', 'moov-togo', 'orange-money-mali', 'moov-ml',
    'orange-money-burkina', 'moov-burkina-faso', 'mtn-cameroun', 'djamo-ci', 'djamo-sn',
    'celtiis-cash',
  ].sort(),
);

const callbackVerifier = new PayDunyaService();
assert.equal(callbackVerifier.verifyCallbackHash('invalid'), false);
const masterKey = process.env.PAYDUNYA_MASTER_KEY?.trim();
if (masterKey) {
  const validHash = crypto.createHash('sha512').update(masterKey).digest('hex');
  assert.equal(callbackVerifier.verifyCallbackHash(validHash), true);
}

const invalidInvoice = await callbackVerifier.createInvoice({
  amount: 199,
  description: 'Offline validation test',
  reference: `PF-TEST-${crypto.randomUUID()}`,
});
assert.equal(invalidInvoice.status, 'failed');
assert.equal(invalidInvoice.isSimulated, false);
assert.equal(invalidInvoice.token, '');
assert.equal(invalidInvoice.invoiceUrl, '');
assert.match(invalidInvoice.error || '', /200 XOF/);

const originalUrlEnv = {
  appUrl: process.env.APP_URL,
  publicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
  callbackUrl: process.env.PAYDUNYA_CALLBACK_URL,
  vercelUrl: process.env.VERCEL_URL,
  nodeEnv: process.env.NODE_ENV,
};
try {
  Reflect.set(process.env, 'NODE_ENV', 'development');
  process.env.APP_URL = 'http://localhost:3000/';
  process.env.NEXT_PUBLIC_APP_URL = '';
  delete process.env.VERCEL_URL;
  delete process.env.PAYDUNYA_CALLBACK_URL;
  assert.equal(getAppBaseUrl(), 'http://localhost:3000');
  assert.equal(getPaymentLinkUrl('licence-1'), 'http://localhost:3000/pay/licence-1');

  Reflect.set(process.env, 'NODE_ENV', 'production');
  process.env.APP_URL = 'http://localhost:3000';
  assert.throws(() => getAppBaseUrl(), /public HTTPS URL/);
  process.env.APP_URL = '';
  process.env.NEXT_PUBLIC_APP_URL = '';
  process.env.VERCEL_URL = 'pichflow.vercel.app';
  assert.equal(getPaymentLinkUrl('licence-1'), 'https://pichflow.vercel.app/pay/licence-1');

  process.env.PAYDUNYA_CALLBACK_URL = 'https://example-tunnel.test/api/webhooks/paydunya';
  assert.equal(getPayDunyaCallbackUrl(), 'https://example-tunnel.test/api/webhooks/paydunya');
} finally {
  if (originalUrlEnv.appUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = originalUrlEnv.appUrl;
  if (originalUrlEnv.publicAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = originalUrlEnv.publicAppUrl;
  if (originalUrlEnv.callbackUrl === undefined) delete process.env.PAYDUNYA_CALLBACK_URL;
  else process.env.PAYDUNYA_CALLBACK_URL = originalUrlEnv.callbackUrl;
  if (originalUrlEnv.vercelUrl === undefined) delete process.env.VERCEL_URL;
  else process.env.VERCEL_URL = originalUrlEnv.vercelUrl;
  if (originalUrlEnv.nodeEnv === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV');
  else Reflect.set(process.env, 'NODE_ENV', originalUrlEnv.nodeEnv);
}

console.log('PichFlow offline regression checks passed.');
