import React, { useEffect, useRef, useState } from 'react';

interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number; // Delay in ms (e.g. 100, 200)
  direction?: 'up' | 'down' | 'left' | 'right' | 'fade' | 'scale';
  distance?: string; // e.g. '24px'
  duration?: number; // default 800ms for slow, elegant reveal
  className?: string;
  style?: React.CSSProperties;
  threshold?: number;
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  delay = 0,
  direction = 'up',
  distance = '28px',
  duration = 800,
  className = '',
  style = {},
  threshold = 0.12,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check user accessibility preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mediaQuery.matches) {
        setPrefersReducedMotion(true);
        setIsVisible(true);
        return;
      }
    }

    if (!ref.current || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      {
        threshold,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [threshold]);

  if (prefersReducedMotion) {
    return (
      <div ref={ref} className={className} style={style}>
        {children}
      </div>
    );
  }

  // Calculate transform offset
  let initialTransform = 'none';
  if (direction === 'up') initialTransform = `translateY(${distance})`;
  else if (direction === 'down') initialTransform = `translateY(-${distance})`;
  else if (direction === 'left') initialTransform = `translateX(${distance})`;
  else if (direction === 'right') initialTransform = `translateX(-${distance})`;
  else if (direction === 'scale') initialTransform = 'scale(0.96)';

  const animatedStyle: React.CSSProperties = {
    ...style,
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'none' : initialTransform,
    transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
    willChange: 'opacity, transform',
  };

  return (
    <div ref={ref} className={className} style={animatedStyle}>
      {children}
    </div>
  );
};

