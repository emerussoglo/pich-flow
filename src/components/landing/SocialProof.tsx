import React from 'react';
import { ScrollReveal } from '../ui/ScrollReveal';

interface PaymentMethod {
  name: string;
  category: string;
  logoUrl: string;
}

export const SocialProof: React.FC = () => {
  const methods: PaymentMethod[] = [
    {
      name: 'MTN Mobile Money',
      category: 'Mobile Money',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/93/New-mtn-logo.jpg',
    },
    {
      name: 'Moov Africa',
      category: 'Mobile Money',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Moov_Africa_B%C3%A9nin.jpg',
    },
    {
      name: 'Celtiis Cash',
      category: 'Mobile Money',
      logoUrl: 'https://celtiis.bj/_next/image?url=%2Fceltiis-logo-rounded.svg&w=64&q=75',
    },
    {
      name: 'Orange Money',
      category: 'Mobile Money',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/19/Logo_Orange_Money.svg',
    },
    {
      name: 'E-Money Expresso',
      category: 'Mobile Money',
      logoUrl: 'https://www.orabank.net/sites/default/files/styles/large/public/2020-12/e-money.png',
    },
    {
      name: 'Djamo',
      category: 'Mobile Money',
      logoUrl: 'https://play-lh.googleusercontent.com/COFlFnBiED3WHi-J8CRd6ehKOzBjvgKGySJasSaOm1OrMZbsn0NVzk3uL4PpzGo7mF91EBaOvbsqRL9ImD_-7A=w240-h480-rw',
    },
    {
      name: 'Orange Money',
      category: 'Mobile Money',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/19/Logo_Orange_Money.svg',
    },
    {
      name: 'Airtel Money',
      category: 'Mobile Money',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/86/Airtel_logo-02.png',
    },
    {
      name: 'Wave',
      category: 'Mobile Money',
      logoUrl: 'https://www.wave.com/img/nav-logo.png',
    },
    {
      name: 'T-Money',
      category: 'Mobile Money',
      logoUrl: 'https://www.ibbank.tg/entreprises/sites/default/files/gbb-uploads/tmoney.jpg',
    },
    {
      name: 'YAS Tigo',
      category: 'Mobile Money',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/cc/Togocom_-_Yas_-_logo.jpg',
    },
    {
      name: 'HaloPesa',
      category: 'Mobile Money',
      logoUrl: 'https://images.seeklogo.com/logo-png/62/1/halopesa-logo-png_seeklogo-625628.png',
    },
    {
      name: 'M-Pesa Vodacom',
      category: 'Mobile Money',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/03/M-pesa-logo.png',
    },
    {
      name: 'Visa / Mastercard',
      category: 'Carte Bancaire',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Visa_Inc._logo_%282021%E2%80%93present%29.svg',
    },
  ];

  // Duplication pour un effet de défilement infini fluide
  const marqueeList = [...methods, ...methods, ...methods];

  return (
    <section className="pf-saas-logos-section">
      <div className="pf-container">
        <ScrollReveal delay={0} duration={750} direction="up" distance="16px">
          <p className="pf-saas-logos-title">
            Moyens de paiement acceptés sur la plateforme
          </p>
        </ScrollReveal>
      </div>

      <div className="pf-marquee-container" aria-label="Moyens de paiement en défilement automatique">
        <div className="pf-marquee-fade-left" aria-hidden="true" />
        <div className="pf-marquee-track">
          {marqueeList.map((item, idx) => (
            <div key={`${item.name}-${idx}`} className="pf-marquee-item">
              <div className="pf-marquee-icon-box">
                <img 
                  src={item.logoUrl} 
                  alt={`Logo ${item.name}`} 
                  className="pf-marquee-logo-img"
                  loading="lazy" 
                />
              </div>
              <div className="pf-marquee-text-col">
                <span className="pf-marquee-name">{item.name}</span>
                <span className="pf-marquee-category">{item.category}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="pf-marquee-fade-right" aria-hidden="true" />
      </div>
    </section>
  );
};