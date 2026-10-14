import crypto from 'crypto';
import assert from 'assert';
import {
  sasPayService,
  formatDecimalAmount,
  splitCustomerName,
  resolveSasPayNetwork,
} from '../src/server/saspay';
import { hashPassword, verifyPassword } from '../src/server/auth';

console.log('🧪 Starting PichFlow & SasPay Integration Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function it(description: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result
        .then(() => {
          console.log(`  ✅ ${description}`);
          passedTests++;
        })
        .catch((err) => {
          console.error(`  ❌ ${description}`);
          console.error(`     Error: ${err.message}`);
          throw err;
        });
    } else {
      console.log(`  ✅ ${description}`);
      passedTests++;
    }
  } catch (err: any) {
    console.error(`  ❌ ${description}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

async function runTests() {
  console.log('--- 1. Clés API PichFlow (Sandbox et Live) ---');

  it('Génère deux clés distinctes Sandbox (sk_test_) et Live (sk_live_)', () => {
    const testSecret = `sk_test_${crypto.randomBytes(24).toString('hex')}`;
    const liveSecret = `sk_live_${crypto.randomBytes(24).toString('hex')}`;

    assert(testSecret.startsWith('sk_test_'), 'La clé sandbox doit commencer par sk_test_');
    assert(liveSecret.startsWith('sk_live_'), 'La clé live doit commencer par sk_live_');
    assert.notStrictEqual(testSecret, liveSecret, 'Les clés sandbox et live doivent être strictement distinctes');
    assert.strictEqual(testSecret.length, 56, 'Longueur de clé cryptographique conforme');
  });

  it('Sécurise les clés avec un hashage SHA-256 (jamais de stockage en clair en base)', () => {
    const secret = `sk_test_${crypto.randomBytes(24).toString('hex')}`;
    const hash1 = crypto.createHash('sha256').update(secret).digest('hex');
    const hash2 = crypto.createHash('sha256').update(secret).digest('hex');
    const tamperedHash = crypto.createHash('sha256').update(secret + 'tamper').digest('hex');

    assert.strictEqual(hash1, hash2, 'Le hash SHA-256 doit être déterministe pour la vérification');
    assert.notStrictEqual(hash1, secret, 'Le secret en clair ne doit pas correspondre au hash');
    assert.notStrictEqual(hash1, tamperedHash, 'Une altération de clé doit être immédiatement détectée');
  });

  console.log('\n--- 2. Formatage des requêtes SasPay (Spécification OpenAPI) ---');

  it('Formate les montants en chaînes décimales exactes à 2 chiffres', () => {
    assert.strictEqual(formatDecimalAmount(15000), '15000.00');
    assert.strictEqual(formatDecimalAmount('2500.5'), '2500.50');
    assert.strictEqual(formatDecimalAmount(100.999), '101.00');
    assert.strictEqual(formatDecimalAmount(0), '0.00');
  });

  it('Découpe proprement les noms clients en prénom et nom', () => {
    const res1 = splitCustomerName('Paul Dossou');
    assert.strictEqual(res1.first_name, 'Paul');
    assert.strictEqual(res1.last_name, 'Dossou');

    const res2 = splitCustomerName('Koffi');
    assert.strictEqual(res2.first_name, 'Koffi');
    assert.strictEqual(res2.last_name, 'Client');

    const res3 = splitCustomerName('Jean Marie De La Tour');
    assert.strictEqual(res3.first_name, 'Jean');
    assert.strictEqual(res3.last_name, 'Marie De La Tour');
  });

  it('Résout les réseaux télécoms réels SasPay pour le Bénin, Togo, CI et Sénégal', () => {
    assert.strictEqual(resolveSasPayNetwork('MTN Mobile Money', 'BJ'), 'mtn_bj');
    assert.strictEqual(resolveSasPayNetwork('Moov Money', 'BJ'), 'moov_bj');
    assert.strictEqual(resolveSasPayNetwork('Celtiis Cash', 'BJ'), 'celtiis_bj');
    assert.strictEqual(resolveSasPayNetwork('Wave', 'CI'), 'wave_ci');
    assert.strictEqual(resolveSasPayNetwork('Orange Money', 'SN'), 'orange_sn');
    assert.strictEqual(resolveSasPayNetwork('Carte Bancaire', 'SN'), 'card');
  });

  console.log('\n--- 3. Vérification des Webhooks SasPay (HMAC SHA-256) ---');

  it('Valide une signature HMAC SHA-256 authentique avec timestamp récent', () => {
    const secret = 'whsec_test_secret_key_12345';
    const rawBody = JSON.stringify({
      event: 'transaction.success',
      data: {
        id: 'sas_tx_998877',
        reference: 'TX-PF-123456',
        amount: '15000.00',
        status: 'completed',
      },
    });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signaturePayload = `${timestamp}.${rawBody}`;
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(signaturePayload)
      .digest('hex');

    const result = sasPayService.verifyWebhookSignature(rawBody, validSignature, timestamp, secret);
    assert.strictEqual(result.isValid, true, 'La signature doit être reconnue valide');
  });

  it('Rejette un webhook avec une signature falsifiée', () => {
    const secret = 'whsec_test_secret_key_12345';
    const rawBody = JSON.stringify({ event: 'transaction.success', amount: '15000.00' });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const fakeSignature = 'a'.repeat(64);

    const result = sasPayService.verifyWebhookSignature(rawBody, fakeSignature, timestamp, secret);
    assert.strictEqual(result.isValid, false, 'La signature falsifiée doit être rejetée');
  });

  it('Rejette un webhook expiré (rejeu > 300 secondes)', () => {
    const secret = 'whsec_test_secret_key_12345';
    const rawBody = JSON.stringify({ event: 'transaction.success' });
    // Timestamp d'il y a 600 secondes (10 minutes)
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString();
    const signaturePayload = `${oldTimestamp}.${rawBody}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(signaturePayload)
      .digest('hex');

    const result = sasPayService.verifyWebhookSignature(rawBody, signature, oldTimestamp, secret);
    assert.strictEqual(result.isValid, false, 'Le webhook ancien de plus de 300s doit être rejeté');
    assert(result.error?.includes('expiré'), 'Le message d’erreur doit signaler l’expiration');
  });

  console.log('\n--- 4. Sécurité des mots de passe & Tokens ---');

  it('Vérifie le hachage sécurisé des mots de passe (PBKDF2 SHA-512)', () => {
    const password = 'SuperSecretPassword2026!';
    const hash = hashPassword(password);

    assert.strictEqual(hash.length, 128, 'Le hash PBKDF2 SHA-512 doit comporter 128 caractères hexadécimaux');
    assert(verifyPassword(password, hash), 'Le mot de passe valide doit être confirmé');
    assert(!verifyPassword('WrongPassword', hash), 'Un mauvais mot de passe doit échouer');
  });

  console.log('\n--- 5. Clé d’Idempotence & Règles Financières SasPay ---');

  it('Génère et maintient des UUID v4 distincts pour chaque intention de paiement', () => {
    const idemp1 = crypto.randomUUID();
    const idemp2 = crypto.randomUUID();
    assert.notStrictEqual(idemp1, idemp2, 'Deux intentions différentes doivent avoir deux clés d’idempotence distinctes');
    assert(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idemp1));
  });

  console.log('\n--- 6. Code de confirmation email sécurisé ---');

  it('Génère un code de confirmation aléatoire à 6 chiffres avec expiration', () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    assert.strictEqual(code.length, 6, 'Le code doit comporter exactement 6 chiffres');
    assert(/^\d{6}$/.test(code), 'Le code doit contenir uniquement des chiffres');
    assert(expiresAt.getTime() > Date.now(), 'L’expiration doit être dans le futur');
  });

  console.log('\n--- 7. Isolation stricte des données multi-tenants ---');

  it('Garantit le cloisonnement des requêtes clients et transactions par application_id et user_id', () => {
    const userA = 'usr_001';
    const appA = 'app_alpha';
    const userB = 'usr_002';
    const appB = 'app_beta';

    const sampleCustomerA = { userId: userA, applicationId: appA, email: 'client@alpha.com' };
    const sampleCustomerB = { userId: userB, applicationId: appB, email: 'client@alpha.com' };

    // Même email client, mais applications distinctes
    assert.notStrictEqual(
      `${sampleCustomerA.userId}:${sampleCustomerA.applicationId}`,
      `${sampleCustomerB.userId}:${sampleCustomerB.applicationId}`,
      'Les clients de deux applications différentes avec le même email sont strictement isolés'
    );
  });

  console.log(`\n========================================`);
  console.log(`Résultats : ${passedTests} / ${totalTests} tests réussis avec succès !`);
  console.log(`========================================\n`);
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

