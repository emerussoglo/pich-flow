import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp } from '@fortawesome/free-solid-svg-icons';

export const BackToTop: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const currentScroll = window.scrollY;

      if (totalHeight > 0) {
        setScrollProgress(Math.min(100, Math.round((currentScroll / totalHeight) * 100)));
      }

      setVisible(currentScroll > 320);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!visible) return null;

  // 2 * PI * r = 2 * 3.14159 * 18 = 113.1
  const strokeDashoffset = 113.1 - (113.1 * scrollProgress) / 100;

  return (
    <div className="pf-back-to-top-container">
      <button
        onClick={scrollToTop}
        className="pf-back-to-top"
        aria-label="Retour en haut de page"
        title={`Retour en haut (${scrollProgress}%)`}
      >
        <svg
          className="pf-back-to-top-svg"
          width="48"
          height="48"
          viewBox="0 0 44 44"
          aria-hidden="true"
        >
          {/* Background track circle */}
          <circle
            cx="22"
            cy="22"
            r="18"
            className="pf-back-to-top-track"
          />
          {/* Progress stroke circle */}
          <circle
            cx="22"
            cy="22"
            r="18"
            className="pf-back-to-top-indicator"
            style={{ strokeDashoffset }}
          />
        </svg>

        <span className="pf-back-to-top-icon-wrap">
          <FontAwesomeIcon icon={faArrowUp} />
        </span>
      </button>
    </div>
  );
};
