import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBolt,
  faBuildingColumns,
  faCloud,
  faCube,
  faRocket,
  faShieldHalved,
  faBagShopping,
  faBriefcase,
} from '@fortawesome/free-solid-svg-icons';

import { ScrollReveal } from '../ui/ScrollReveal';

interface PartnerLogo {
  name: string;
  category: string;
  icon: any;
}

export const SocialProof: React.FC = () => {
  const partners: PartnerLogo[] = [
    { name: 'NoviaAgency', category: 'Agence SaaS', icon: faRocket },
    { name: 'Konbini Pay', category: 'Plateforme Média', icon: faCloud },
    { name: 'AsukaImmo', category: 'PropTech & Location', icon: faBuildingColumns },
    { name: 'EducX', category: 'EdTech Afrique', icon: faCube },
    { name: 'MoneyChap', category: 'Remittance & FinTech', icon: faBolt },
    { name: 'PuyakExpress', category: 'Logistique & E-commerce', icon: faBagShopping },
    { name: 'TonJob Pro', category: 'Recrutement RH', icon: faBriefcase },
    { name: 'SaasFlow AF', category: 'Facturation B2B', icon: faShieldHalved },
  ];

  // Duplicate for seamless infinite marquee loop
  const marqueeList = [...partners, ...partners, ...partners];

  return (
    <section className="pf-saas-logos-section">
      <div className="pf-container">
        <ScrollReveal delay={0} duration={750} direction="up" distance="16px">
          <p className="pf-saas-logos-title">
            Solution adoptée par des SaaS en pleine croissance
          </p>
        </ScrollReveal>
      </div>

      {/* Infinite scrolling marquee track */}
      <div className="pf-marquee-container" aria-label="Partenaires SaaS en défilement automatique">
        <div className="pf-marquee-fade-left" aria-hidden="true" />
        <div className="pf-marquee-track">
          {marqueeList.map((item, idx) => (
            <div key={`${item.name}-${idx}`} className="pf-marquee-item">
              <div className="pf-marquee-icon-box">
                <FontAwesomeIcon icon={item.icon} />
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
