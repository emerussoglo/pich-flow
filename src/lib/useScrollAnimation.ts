import { useEffect } from 'react';

export function useScrollAnimation() {
  useEffect(() => {
    // Check if IntersectionObserver is supported
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('pf-reveal-visible');
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    // Observe elements with .pf-reveal or automatically apply to section headers & cards
    const targets = document.querySelectorAll(
      '.pf-reveal, .pf-section-center-head, .pf-compare-card, .pf-pricing-single-card, .pf-faq-row-item, .pf-final-cta-banner'
    );

    targets.forEach((el) => {
      el.classList.add('pf-reveal');
      observer.observe(el);
    });

    return () => {
      targets.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, []);
}
