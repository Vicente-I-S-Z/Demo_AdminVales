import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { Children, cloneElement, isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode, MouseEvent } from 'react';

import './Dock.css';

interface DockItemProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  mouseX: MotionValue<number>;
  spring: any;
  distance: number;
  magnification: number;
  baseItemSize: number;
  label?: string;
  isActive?: boolean;
}

function DockItem({
  children,
  className = '',
  onClick,
  mouseX,
  spring,
  distance,
  magnification,
  baseItemSize,
  label,
  isActive = false
}: DockItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isHovered = useMotionValue(0);

  const mouseDistance = useTransform(mouseX, (val: number) => {
    const rect = ref.current?.getBoundingClientRect() ?? {
      x: 0,
      width: baseItemSize
    };
    return val - rect.x - baseItemSize / 2;
  });

  const targetSize = useTransform(mouseDistance, [-distance, 0, distance], [baseItemSize, magnification, baseItemSize]);
  const size = useSpring(targetSize, spring);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <motion.div
      ref={ref}
      style={{
        width: size,
        height: size
      }}
      onHoverStart={() => isHovered.set(1)}
      onHoverEnd={() => isHovered.set(0)}
      onFocus={() => isHovered.set(1)}
      onBlur={() => isHovered.set(0)}
      onClick={onClick}
      className={`dock-item ${isActive ? 'dock-active' : ''} ${className}`}
      tabIndex={0}
      role="button"
      aria-haspopup="true"
      aria-label={label}
      onKeyDown={handleKeyDown}
    >
      {Children.map(children, child => {
        if (isValidElement(child)) {
          return cloneElement(child as ReactElement<any>, { isHovered });
        }
        return null;
      })}
    </motion.div>
  );
}

function DockLabel({ children, className = '', isHovered }: any) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = isHovered?.on('change', (latest: number) => {
      setIsVisible(latest === 1);
    });
    return () => unsubscribe?.();
  }, [isHovered]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: -10 }}
          exit={{ opacity: 0, y: 0 }}
          transition={{ duration: 0.2 }}
          className={`dock-label ${className}`}
          role="tooltip"
          style={{ x: '-50%' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DockIcon({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`dock-icon ${className}`}>{children}</div>;
}

export interface DockItemData {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
  isActive?: boolean;
}

interface DockProps {
  items: DockItemData[];
  className?: string;
  spring?: any;
  magnification?: number;
  distance?: number;
  panelHeight?: number;
  dockHeight?: number;
  baseItemSize?: number;
}

export default function Dock({
  items,
  className = '',
  spring = { mass: 0.1, stiffness: 150, damping: 12 },
  magnification = 70,
  distance = 200,
  panelHeight = 68,
  dockHeight = 256,
  baseItemSize = 50
}: DockProps) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const effectiveBaseItemSize = isMobile ? 38 : baseItemSize;
  const effectiveMagnification = isMobile ? 42 : magnification;
  const effectivePanelHeight = isMobile ? 54 : panelHeight;
  const effectiveDistance = isMobile ? 100 : distance;

  const mouseX = useMotionValue(Infinity);
  const isHovered = useMotionValue(0);

  // En celular no hay etiquetas emergentes, así que el Dock no necesita crecer al tocarlo
  // (si crece, su área invisible tapa el contenido que está justo encima).
  const maxHeight = useMemo(
    () =>
      isMobile
        ? effectivePanelHeight
        : Math.max(dockHeight, effectiveMagnification + effectiveMagnification / 2 + 4),
    [isMobile, effectivePanelHeight, effectiveMagnification, dockHeight]
  );
  const heightRow = useTransform(isHovered, [0, 1], [effectivePanelHeight, maxHeight]);
  const height = useSpring(heightRow, spring);

  return (
    <motion.div style={{ height, scrollbarWidth: 'none' }} className="dock-outer">
      <motion.div
        onMouseMove={(e: MouseEvent<HTMLDivElement>) => {
          isHovered.set(1);
          mouseX.set(e.pageX);
        }}
        onMouseLeave={() => {
          isHovered.set(0);
          mouseX.set(Infinity);
        }}
        className={`dock-panel z-50 ${className}`}
        style={{ height: effectivePanelHeight }}
        role="toolbar"
        aria-label="Application dock"
      >
        {items.map((item, index) => (
          <DockItem
            key={index}
            onClick={item.onClick}
            className={item.className}
            isActive={item.isActive}
            mouseX={mouseX}
            spring={spring}
            distance={effectiveDistance}
            magnification={effectiveMagnification}
            baseItemSize={effectiveBaseItemSize}
            label={item.label}
          >
            <DockIcon>{item.icon}</DockIcon>
            {!isMobile ? <DockLabel>{item.label}</DockLabel> : null}
          </DockItem>
        ))}
      </motion.div>
    </motion.div>
  );
}
