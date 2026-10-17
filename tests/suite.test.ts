import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { SUPPORTED_COUNTRIES } from '../src/config/countries';
import { PRICING_CONFIG } from '../src/config/pricing';
import { PayDunyaService } from '../src/server/paydunya';
import { hashPassword, verifyPassword } from '../src/server/auth';

console.log('Running PichFlow offline regression checks...');

const password = 'TestOnly-ValidPassword-456!';
const passwordHash = hashPassword(password);
assert.equal(passwordHash.length, 128);
assert.equal(verifyPassword(password, passwordHash), true);
assert.equal(verifyPassword('incorrect password', passwordHash), false);
assert.equal(PRICING_CONFIG.feeScheduleConfirmed, false);
assert.equal(PRICING_CONFIG.customerSurchargeEnabled, false);
assert.deepEqual(SUPPORTED_COUNTRIES.map((country) => country.code), ['BJ']);
assert.deepEqual(SUPPORTED_COUNTRIES[0].methods, []);

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

console.log('PichFlow offline regression checks passed.');
