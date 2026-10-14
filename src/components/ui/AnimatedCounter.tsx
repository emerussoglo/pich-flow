import React, { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  end: number;
  start?: number;
  duration?: number; // duration in ms (default 2200ms)
  delay?: number; // delay before counter starts counting up in ms
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  end,
  start = 0,
  duration = 2200,
  delay = 150,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
  style = {},
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [currentValue, setCurrentValue] = useState<number>(start);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    // Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mediaQuery.matches) {
        setCurrentValue(end);
        return;
      }
    }

    if (!ref.current || typeof IntersectionObserver === 'undefined') {
      setCurrentValue(end);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setTimeout(() => {
            setHasStarted(true);
          }, delay);
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -20px 0px',
      }
    );

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [end, hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;

    let startTime: number | null = null;
    let animationFrameId: number;

    const easeOutExpo = (t: number): number => {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    };

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easedProgress = easeOutExpo(progress);

      const nextVal = start + (end - start) * easedProgress;
      setCurrentValue(nextVal);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setCurrentValue(end);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [hasStarted, start, end, duration]);

  // Format with french thousands space separator
  const formattedNumber = (() => {
    if (decimals > 0) {
      const parts = currentValue.toFixed(decimals).split('.');
      parts[0] = Math.round(Number(parts[0])).toLocaleString('fr-FR');
      return parts.join(',');
    }
    return Math.round(currentValue).toLocaleString('fr-FR');
  })();

  return (
    <span ref={ref} className={className} style={style}>
      {prefix}
      {formattedNumber}
      {suffix}
    </span>
  );
};
