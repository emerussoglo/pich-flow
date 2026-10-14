import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBook,
  faCode,
  faKey,
  faCopy,
  faCheck,
  faShieldHalved,
  faReceipt,
  faMobileScreen,
  faRotateRight,
} from '@fortawesome/free-solid-svg-icons';
import { useToast } from '../ui/ToastContext';
import { useRouter } from '../../lib/router';

export const DocumentationView: React.FC = () => {
  const { docsTab, navigate } = useRouter();
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [langTab, setLangTab] = useState<'curl' | 'node' | 'python' | 'php'>('curl');
  const { showToast } = useToast();

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    showToast('Code copié dans le presse-papier !', 'success');
    setTimeout(() => setCopiedSnippet(null), 2500);
  };

  const handleSelectSection = (section: string) => {
    navigate(`/documentation/${section}`);
  };

  const cUrlCreatePayment = `curl -X POST https://api.pichflow.com/v1/payments \\
  -H "Authorization: Bearer sk_test_pichflow_89f7a1e0b" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: ord_1024_uuid" \\
  -d '{
    "amount": 15000,
    "currency": "XOF",
    "payment_method": "momo",
    "customer": {
      "name": "Koffi Mensah",
      "email": "koffi@example.com",
      "phone": "+22997123456"
    },
    "description": "Commande Pro #1024",
    "callback_url": "https://monsite.com/api/pichflow-webhook",
    "return_url": "https://monsite.com/commande/succes"
  }'`;

  const nodeCreatePayment = `import { PichFlow } from '@pichflow/sdk';

const pichflow = new PichFlow({
  apiKey: process.env.PICHFLOW_SECRET_KEY,
  environment: 'sandbox' // ou 'live'
});

const payment = await pichflow.payments.create({
  amount: 15000,
  currency: 'XOF',
  paymentMethod: 'momo',
  customer: {
    name: 'Koffi Mensah',
    email: 'koffi@example.com',
    phone: '+22997123456'
  },
  callbackUrl: 'https://monsite.com/api/webhooks',
  returnUrl: 'https://monsite.com/succes'
});

console.log('Paiement initié:', payment.checkoutUrl);`;

  const pythonCreatePayment = `import pichflow

client = pichflow.Client(
    api_key="sk_test_pichflow_89f7a1e0b",
    environment="sandbox"
)

payment = client.payments.create(
    amount=15000,
    currency="XOF",
    payment_method="momo",
    customer={
        "name": "Koffi Mensah",
        "email": "koffi@example.com",
        "phone": "+22997123456"
    },
    callback_url="https://monsite.com/api/webhooks"
)

print(payment.checkout_url)`;

  const phpCreatePayment = `<?php
require_once 'vendor/autoload.php';

$pichflow = new \\PichFlow\\Client([
    'api_key' => 'sk_test_pichflow_89f7a1e0b',
    'environment' => 'sandbox'
]);

$payment = $pichflow->payments->create([
    'amount' => 15000,
    'currency' => 'XOF',
    'payment_method' => 'momo',
    'customer' => [
        'name' => 'Koffi Mensah',
        'email' => 'koffi@example.com',
        'phone' => '+22997123456'
    ],
    'callback_url' => 'https://monsite.com/api/webhooks'
]);

header('Location: ' . $payment->checkout_url);
exit;`;

  const webhookVerifyNode = `import crypto from 'crypto';

export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const calculated = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(calculated));
}`;

  return (
    <div className="pf-docs-container">
      {/* Docs Sidebar */}
      <aside className="pf-docs-sidebar">
        <div className="pf-docs-menu-group">
          <div className="pf-docs-menu-title">Démarrage</div>
          <button
            onClick={() => handleSelectSection('quickstart')}
            className={`pf-docs-menu-item ${docsTab === 'quickstart' ? 'active' : ''}`}
          >
            <FontAwesomeIcon icon={faBook} style={{ marginRight: '0.5rem', fontSize: '0.8rem' }} />
            Guide rapide
          </button>
          <button
            onClick={() => handleSelectSection('auth')}
            className={`pf-docs-menu-item ${docsTab === 'auth' ? 'active' : ''}`}
          >
            <FontAwesomeIcon icon={faKey} style={{ marginRight: '0.5rem', fontSize: '0.8rem' }} />
            Authentification & Clés
          </button>
        </div>

        <div className="pf-docs-menu-group">
          <div className="pf-docs-menu-title">Référence API</div>
          <button
            onClick={() => handleSelectSection('payments')}
            className={`pf-docs-menu-item ${docsTab === 'payments' ? 'active' : ''}`}
          >
            <FontAwesomeIcon icon={faReceipt} style={{ marginRight: '0.5rem', fontSize: '0.8rem' }} />
            Paiements (POST /payments)
          </button>
          <button
            onClick={() => handleSelectSection('mobile-money')}
            className={`pf-docs-menu-item ${docsTab === 'mobile-money' ? 'active' : ''}`}
          >
            <FontAwesomeIcon icon={faMobileScreen} style={{ marginRight: '0.5rem', fontSize: '0.8rem' }} />
            Mobile Money (USSD Push)
          </button>
          <button
            onClick={() => handleSelectSection('webhooks')}
            className={`pf-docs-menu-item ${docsTab === 'webhooks' ? 'active' : ''}`}
          >
            <FontAwesomeIcon icon={faCode} style={{ marginRight: '0.5rem', fontSize: '0.8rem' }} />
            Webhooks & HMAC-SHA256
          </button>
          <button
            onClick={() => handleSelectSection('idempotency')}
            className={`pf-docs-menu-item ${docsTab === 'idempotency' ? 'active' : ''}`}
          >
            <FontAwesomeIcon icon={faShieldHalved} style={{ marginRight: '0.5rem', fontSize: '0.8rem' }} />
            Idempotence & Sécurité
          </button>
        </div>
      </aside>

      {/* Docs Main Content */}
      <main className="pf-docs-content">
        {/* 1. QUICKSTART */}
        {docsTab === 'quickstart' && (
          <div>
            <div className="pf-section-badge">Démarrage rapide</div>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--pf-text)' }}>
              Intégrer PichFlow en 5 minutes
            </h1>
            <p style={{ fontSize: '1.05rem', color: 'var(--pf-muted)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
              Bienvenue sur la documentation technique de <strong>PichFlow</strong>. L'API RESTful vous permet d'encaisser des paiements par Mobile Money et cartes bancaires via des requêtes HTTP simples et prévisibles.
            </p>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '1.75rem 0 0.75rem 0' }}>
              1. Obtenir vos clés Sandbox
            </h3>
            <p style={{ color: 'var(--pf-muted)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
              Dans votre tableau de bord PichFlow, rendez-vous dans l'onglet <strong>Développeurs &gt; Clés d'API</strong>. Vous disposez immédiatement d'une clé publique <code>pk_test_...</code> et d'une clé secrète <code>sk_test_...</code>.
            </p>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '1.75rem 0 0.75rem 0' }}>
              2. URL de base de l'API
            </h3>
            <div className="pf-docs-code-box">
              <pre>
                <code>{`Environnement Sandbox : https://api.pichflow.com/v1
Environnement Live    : https://api.pichflow.com/v1`}</code>
              </pre>
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '2rem 0 0.75rem 0' }}>
              3. Exemple de création de paiement
            </h3>
            <div className="pf-docs-code-container">
              <div className="pf-docs-code-header">
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setLangTab('curl')}
                    className={`pf-code-lang-btn ${langTab === 'curl' ? 'active' : ''}`}
                  >
                    cURL
                  </button>
                  <button
                    onClick={() => setLangTab('node')}
                    className={`pf-code-lang-btn ${langTab === 'node' ? 'active' : ''}`}
                  >
                    Node.js
                  </button>
                  <button
                    onClick={() => setLangTab('python')}
                    className={`pf-code-lang-btn ${langTab === 'python' ? 'active' : ''}`}
                  >
                    Python
                  </button>
                  <button
                    onClick={() => setLangTab('php')}
                    className={`pf-code-lang-btn ${langTab === 'php' ? 'active' : ''}`}
                  >
                    PHP
                  </button>
                </div>
                <button
                  onClick={() => handleCopy('quick', langTab === 'curl' ? cUrlCreatePayment : langTab === 'node' ? nodeCreatePayment : langTab === 'python' ? pythonCreatePayment : phpCreatePayment)}
                  className="pf-docs-copy-btn"
                >
                  <FontAwesomeIcon icon={copiedSnippet === 'quick' ? faCheck : faCopy} />
                  <span>{copiedSnippet === 'quick' ? 'Copié' : 'Copier'}</span>
                </button>
              </div>
              <div className="pf-docs-code-box">
                <pre>
                  <code>
                    {langTab === 'curl' && cUrlCreatePayment}
                    {langTab === 'node' && nodeCreatePayment}
                    {langTab === 'python' && pythonCreatePayment}
                    {langTab === 'php' && phpCreatePayment}
                  </code>
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* 2. AUTHENTICATION */}
        {docsTab === 'auth' && (
          <div>
            <div className="pf-section-badge">Sécurité</div>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--pf-text)' }}>
              Authentification des requêtes
            </h1>
            <p style={{ fontSize: '1.05rem', color: 'var(--pf-muted)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
              Toutes les requêtes vers l'API PichFlow doivent inclure votre clé secrète dans l'en-tête HTTP <code>Authorization</code> sous forme de Bearer Token.
            </p>

            <div className="pf-docs-code-box">
              <pre>
                <code>{`Authorization: Bearer sk_test_pichflow_89f7a1e0b`}</code>
              </pre>
            </div>

            <div style={{ padding: '1.25rem', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 'var(--pf-radius-md)', color: '#92400E', fontSize: '0.875rem', marginTop: '1.5rem' }}>
              <strong>Recommandation de sécurité :</strong> Ne publiez jamais votre clé secrète côté client (React, application mobile Android/iOS, code GitHub public). Utilisez votre serveur backend comme intermédiaire.
            </div>
          </div>
        )}

        {/* 3. PAYMENTS */}
        {docsTab === 'payments' && (
          <div>
            <div className="pf-section-badge">Encaissement</div>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--pf-text)' }}>
              Créer un paiement (POST /v1/payments)
            </h1>
            <p style={{ fontSize: '1.05rem', color: 'var(--pf-muted)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
              Cet endpoint initialise une transaction et renvoie une URL de checkout ou déclenche directement une notification de paiement sur le téléphone de l'utilisateur.
            </p>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '1.5rem 0 0.75rem 0' }}>
              Corps de la requête (JSON)
            </h3>
            <div className="pf-table-container">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Champ</th>
                    <th>Type</th>
                    <th>Requis</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>amount</code></td>
                    <td>Nombre entier</td>
                    <td>Oui</td>
                    <td>Montant du paiement (ex: <code>15000</code> pour 15 000 XOF).</td>
                  </tr>
                  <tr>
                    <td><code>currency</code></td>
                    <td>Chaîne</td>
                    <td>Oui</td>
                    <td>Code devise ISO : <code>XOF</code>, <code>XAF</code>, <code>EUR</code>, <code>USD</code>.</td>
                  </tr>
                  <tr>
                    <td><code>payment_method</code></td>
                    <td>Chaîne</td>
                    <td>Non</td>
                    <td><code>momo</code> (Mobile Money) ou <code>card</code> (Carte bancaire).</td>
                  </tr>
                  <tr>
                    <td><code>customer.phone</code></td>
                    <td>Chaîne</td>
                    <td>Conditionnel</td>
                    <td>Numéro au format international (ex: <code>+22997123456</code>). Requis pour push Mobile Money.</td>
                  </tr>
                  <tr>
                    <td><code>callback_url</code></td>
                    <td>Chaîne (URL)</td>
                    <td>Oui</td>
                    <td>URL de votre webhook serveur recevant l'événement <code>payment.success</code>.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. MOBILE MONEY */}
        {docsTab === 'mobile-money' && (
          <div>
            <div className="pf-section-badge">Mobile Money</div>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--pf-text)' }}>
              Paiement direct USSD Push
            </h1>
            <p style={{ fontSize: '1.05rem', color: 'var(--pf-muted)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
              Pour les opérateurs Mobile Money (MTN MoMo, Moov Money, Wave, Orange Money), vous pouvez déclencher un push direct sur le terminal du client sans le rediriger vers une page de paiement externe.
            </p>

            <div className="pf-docs-code-box">
              <pre>
                <code>{`POST /v1/payments
{
  "amount": 25000,
  "currency": "XOF",
  "payment_method": "momo",
  "operator": "mtn_bj",
  "customer": {
    "phone": "+22997123456"
  }
}

// Réponse immédiate :
{
  "id": "pay_98234710",
  "status": "pending_customer_approval",
  "message": "Invite USSD envoyée sur le mobile +22997123456"
}`}</code>
              </pre>
            </div>
          </div>
        )}

        {/* 5. WEBHOOKS */}
        {docsTab === 'webhooks' && (
          <div>
            <div className="pf-section-badge">Temps réel</div>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--pf-text)' }}>
              Webhooks & Signature HMAC-SHA256
            </h1>
            <p style={{ fontSize: '1.05rem', color: 'var(--pf-muted)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
              Les webhooks vous informent en temps réel de chaque événement de paiement (succès, échec, expiration). Chaque webhook est signé cryptographiquement dans l'en-tête <code>X-PichFlow-Signature</code>.
            </p>

            <div className="pf-docs-code-container">
              <div className="pf-docs-code-header">
                <span>Vérification de signature en Node.js</span>
                <button
                  onClick={() => handleCopy('wh', webhookVerifyNode)}
                  className="pf-docs-copy-btn"
                >
                  <FontAwesomeIcon icon={copiedSnippet === 'wh' ? faCheck : faCopy} />
                  <span>{copiedSnippet === 'wh' ? 'Copié' : 'Copier'}</span>
                </button>
              </div>
              <div className="pf-docs-code-box">
                <pre>
                  <code>{webhookVerifyNode}</code>
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* 6. IDEMPOTENCY */}
        {docsTab === 'idempotency' && (
          <div>
            <div className="pf-section-badge">Fiabilité</div>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--pf-text)' }}>
              Idempotence & Prévention des doubles débits
            </h1>
            <p style={{ fontSize: '1.05rem', color: 'var(--pf-muted)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
              En Afrique où les connexions mobiles peuvent fluctuer, PichFlow prend en charge l'en-tête standard <code>Idempotency-Key</code> pour garantir qu'une commande ne soit jamais débitée deux fois en cas de coupure réseau ou de retry intempestif.
            </p>

            <div className="pf-docs-code-box">
              <pre>
                <code>{`POST /v1/payments
Idempotency-Key: ord_2026_unique_uuid_9831

// Si le même appel est rejoué, PichFlow renvoie le même résultat sans créer de nouvelle transaction.`}</code>
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
