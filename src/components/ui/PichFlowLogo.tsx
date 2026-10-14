import React from 'react';

interface PichFlowLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  textClassName?: string;
  className?: string;
}

export const PichFlowLogo: React.FC<PichFlowLogoProps> = ({
  size = 'md',
  showText = true,
  textClassName = '',
  className = '',
}) => {
  // Dimensions for the card icon
  const iconDimensions = {
    sm: { box: 28, svgWidth: 18, svgHeight: 14 },
    md: { box: 36, svgWidth: 22, svgHeight: 16 },
    lg: { box: 44, svgWidth: 26, svgHeight: 19 },
    xl: { box: 54, svgWidth: 32, svgHeight: 23 },
  }[size];

  const textSizeClass = {
    sm: 'text-sm font-bold',
    md: 'text-lg font-extrabold',
    lg: 'text-xl font-extrabold',
    xl: 'text-2xl font-black',
  }[size];

  return (
    <div
      className={`inline-flex items-center select-none ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.625rem', userSelect: 'none' }}
    >
      {/* Bespoke Fintech Payment Card Emblem */}
      <div
        style={{
          width: `${iconDimensions.box}px`,
          height: `${iconDimensions.box}px`,
          borderRadius: size === 'sm' ? '8px' : size === 'xl' ? '14px' : '10px',
          background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 60%, #1E40AF 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px -2px rgba(37, 99, 235, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.35)',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle glass reflection on the top half */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '46%',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0) 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* Sleek Credit / Payment Card Icon with Chip & Contactless Waves */}
        <svg
          width={iconDimensions.svgWidth}
          height={iconDimensions.svgHeight}
          viewBox="0 0 24 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Card outline & base */}
          <rect
            x="0.75"
            y="0.75"
            width="22.5"
            height="16.5"
            rx="3"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            fill="none"
          />
          {/* Magnetic Stripe / Card Header Bar */}
          <line
            x1="1"
            y1="5"
            x2="23"
            y2="5"
            stroke="#93C5FD"
            strokeWidth="1.5"
            strokeOpacity="0.8"
          />
          {/* EMV Microchip */}
          <rect
            x="3.75"
            y="8"
            width="4.5"
            height="3.5"
            rx="0.75"
            fill="#FBBF24"
          />
          {/* Microchip internal line */}
          <line
            x1="6"
            y1="8"
            x2="6"
            y2="11.5"
            stroke="#D97706"
            strokeWidth="0.5"
          />
          {/* Flowing embossed dots / contactless indicator */}
          <circle cx="12" cy="13" r="1.1" fill="#FFFFFF" />
          <circle cx="15.5" cy="13" r="1.1" fill="#93C5FD" />
          <circle cx="19" cy="13" r="1.1" fill="#60A5FA" />
        </svg>
      </div>

      {showText && (
        <span
          className={`font-sans tracking-tight text-slate-900 ${textSizeClass} ${textClassName}`}
          style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 800,
            letterSpacing: '-0.035em',
            color: '#0F172A',
          }}
        >
          Pich<span style={{ color: '#2563EB' }}>Flow</span>
        </span>
      )}
    </div>
  );
};