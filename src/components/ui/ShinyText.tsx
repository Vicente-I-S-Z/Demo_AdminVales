import React from 'react';

interface ShinyTextProps {
  text?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  speed?: number;
  className?: string;
}

/**
 * Componente ShinyText inspirado en React Bits (https://reactbits.dev/text-animations/shiny-text)
 * Agrega un efecto de brillo y reflejo metálico sobre el texto.
 */
export const ShinyText: React.FC<ShinyTextProps> = ({
  text,
  children,
  disabled = false,
  speed = 4,
  className = '',
}) => {
  const animationDuration = `${speed}s`;

  return (
    <span
      className={`inline-block bg-clip-text font-bold ${
        disabled ? '' : 'animate-shine'
      } ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(120deg, rgba(255, 255, 255, 0.2) 25%, rgba(255, 255, 255, 1) 50%, rgba(255, 255, 255, 0.2) 75%)',
        backgroundSize: '250% 100%',
        WebkitBackgroundClip: 'text',
        animationDuration: animationDuration,
      }}
    >
      {text || children}
    </span>
  );
};

export default ShinyText;
