'use client';

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBook,
  faCopy,
  faKey,
  faReceipt,
  faRotateRight,
  faShieldHalved,
} from '@fortawesome/free-solid-svg-icons';
import { APP_CONFIG } from '../../config/app';
import { useToast } from '../ui/ToastContext';
import { useRouter } from '../../lib/router';

const productionApiBase = APP_CONFIG.apiBaseUrl;
const apiBase = process.env.NODE_ENV === 'production'
  ? productionApiBase
  : 'http://localhost:3000/api/v1';

const checkoutSnippet = `curl -X POST "${apiBase}/checkout-sessions" \\
  -H "Authorization: Bearer pf_test_<secret>" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: order-123-checkout-1" \\
  -d '{
    "paymentLinkId": "<payment-link-id>",
    "customerName": "Awa Exemple",
    "customerEmail": "awa@example.test",
    "customerPhone": "+22997000000"
  }'`;

const sections = [
  { id: 'quickstart', label: 'API disponible', icon: faBook },
  { id: 'auth', label: 'Clés API', icon: faKey },
  { id: 'payments', label: 'Créer un checkout', icon: faReceipt },
  { id: 'webhooks', label: 'Notifications', icon: faShieldHalved },
  { id: 'idempotency', label: 'Idempotence', icon: faRotateRight },
] as const;

export const DocumentationView: React.FC = () => {
  const { docsTab, navigate } = useRouter();
  const { showToast } = useToast();
  const activeSection = sections.find((section) => section.id === docsTab)?.id || 'quickstart';

  const copyCheckout = async () => {
    try {
      await navigator.clipboard.writeText(checkoutSnippet);
      showToast('Exemple copié.', 'success');
    } catch {
      showToast('Impossible de copier le code.', 'error');
    }
  };

  return (
    <div className="pf-docs-container">
      <aside className="pf-docs-sidebar">
        <div className="pf-docs-menu-group">
          <div className="pf-docs-menu-title">API PichFlow</div>
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => navigate(`/documentation/${section.id}`)}
              className={`pf-docs-menu-item ${activeSection === section.id ? 'active' : ''}`}
              type="button"
            >
              <FontAwesomeIcon icon={section.icon} style={{ marginRight: '0.5rem', fontSize: '0.8rem' }} />
              {section.label}
            </button>
          ))}
        </div>
      </aside>

      <main className="pf-docs-content">
        <div className="pf-section-badge">PichFlow · PayDunya · XOF / BJ</div>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--pf-text)' }}>
          {sections.find((section) => section.id === activeSection)?.label}
        </h1>

        {activeSection === 'quickstart' && (
          <>
            <p>
              L'API publique actuelle permet de lister ou créer des liens, d'ouvrir une session de checkout et de vérifier son statut.
              Le serveur PichFlow appelle PayDunya; la clé PayDunya ne quitte jamais le serveur.
            </p>
            <div className="pf-docs-code-box">
              <pre><code>{`Production : ${productionApiBase}\nLocal      : http://localhost:3000/api/v1`}</code></pre>
            </div>
            <ul>
              <li><code>GET /payment-links</code> et <code>POST /payment-links</code></li>
              <li><code>POST /checkout-sessions</code></li>
              <li><code>GET /payments/&#123;reference&#125;</code></li>
            </ul>
            <p>
              XOF et le pays BJ sont configurés actuellement. Vérifiez l'activation de ces services auprès de PayDunya avant la production.
              Les autres devises, pays et moyens ne sont pas promis par cette API.
            </p>
          </>
        )}

        {activeSection === 'auth' && (
          <>
            <p>
              Créez une clé depuis le centre développeur pour l'application concernée. Les clés PichFlow utilisent les préfixes
              <code> pf_test_</code> et <code>pf_live_</code>; leur secret complet n'est renvoyé qu'à la création.
            </p>
            <div className="pf-docs-code-box">
              <pre><code>{`Authorization: Bearer pf_test_<secret>\nContent-Type: application/json`}</code></pre>
            </div>
            <p>
              La clé est liée à une application côté serveur. Ne transmettez pas une clé d'intégration au navigateur.
              Les variables PayDunya doivent être configurées uniquement côté serveur et <code>PAYDUNYA_MODE</code> doit
              correspondre à l'environnement de la clé. La production échoue de façon explicite si le mode n'est pas défini.
            </p>
          </>
        )}

        {activeSection === 'payments' && (
          <>
            <p>
              Créez d'abord un lien fixe ou à montant libre. Pour une session, fournissez son ID ou son slug, le nom, l'e-mail
              et le téléphone du client. Les prix fixes sont toujours lus en base; le montant transmis par un navigateur ne les remplace pas.
            </p>
            <div className="pf-docs-code-container">
              <div className="pf-docs-code-header">
                <span>Créer une session PayDunya via PichFlow</span>
                <button onClick={copyCheckout} className="pf-docs-copy-btn" type="button">
                  <FontAwesomeIcon icon={faCopy} />
                  <span>Copier</span>
                </button>
              </div>
              <div className="pf-docs-code-box"><pre><code>{checkoutSnippet}</code></pre></div>
            </div>
            <p>
              Une session créée est <code>pending</code>. Redirigez le client vers <code>data.checkoutUrl</code> et vérifiez
              le paiement avec <code>GET /payments/&#123;reference&#125;</code>; seul le statut confirmé côté serveur vaut paiement réussi.
            </p>
          </>
        )}

        {activeSection === 'webhooks' && (
          <>
            <p>
              Le callback entrant PayDunya est <code>POST /api/webhooks/paydunya</code>. PichFlow valide le hash SHA-512
              et confirme la facture auprès du fournisseur avant d'enregistrer le règlement.
            </p>
            <p>
              Les notifications marchandes peuvent recevoir <code>payment.succeeded</code>, avec les en-têtes
              <code> X-PichFlow-Event</code> et <code>X-PichFlow-Signature</code>. La signature est HMAC-SHA-256 du corps.
              Une seule tentative est effectuée; aucun retry automatique n'est implémenté.
            </p>
          </>
        )}

        {activeSection === 'idempotency' && (
          <>
            <p>
              Chaque création de session doit fournir un en-tête <code>Idempotency-Key</code> de 8 à 100 caractères.
              Réutilisez la même valeur uniquement pour le retry de la même commande; une autre commande doit avoir une clé distincte.
            </p>
            <div className="pf-docs-code-box">
              <pre><code>{`Idempotency-Key: order-123-checkout-1`}</code></pre>
            </div>
            <p>
              Une clé réutilisée avec d'autres données ou un autre lien est refusée. Le stockage de cette clé empêche de créer
              plusieurs sessions PichFlow pour la même intention, mais ne remplace pas le rapprochement du statut PayDunya.
            </p>
          </>
        )}

        <p style={{ marginTop: '2rem', color: 'var(--pf-muted)' }}>
          Les tests automatisés utilisent un réseau PayDunya simulé localement; aucune transaction sandbox réelle n'a été vérifiée ici.
          Les détails complets des schémas et exemples sont disponibles dans la documentation API publiée.
        </p>
      </main>
    </div>
  );
};
