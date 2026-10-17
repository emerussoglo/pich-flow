import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PayDunyaService } from '../src/server/paydunya';
import { hashPassword, verifyPassword } from '../src/server/auth';

console.log('Running PichFlow offline regression checks...');

const password = 'TestOnly-ValidPassword-456!';
const passwordHash = hashPassword(password);
assert.equal(passwordHash.length, 128);
assert.equal(verifyPassword(password, passwordHash), true);
assert.equal(verifyPassword('incorrect password', passwordHash), false);

const callbackVerifier = new PayDunyaService();
assert.equal(callbackVerifier.verifyCallbackHash('invalid'), false);
const masterKey = process.env.PAYDUNYA_MASTER_KEY?.trim();
if (masterKey) {
  const validHash = crypto.createHash('sha512').update(masterKey).digest('hex');
  assert.equal(callbackVerifier.verifyCallbackHash(validHash), true);
}

const invalidInvoice = await callbackVerifier.createInvoice({
  amount: 0,
  description: 'Offline validation test',
  reference: `PF-TEST-${crypto.randomUUID()}`,
});
assert.equal(invalidInvoice.status, 'failed');
assert.equal(invalidInvoice.isSimulated, false);
assert.equal(invalidInvoice.token, '');
assert.equal(invalidInvoice.invoiceUrl, '');

console.log('PichFlow offline regression checks passed.');
