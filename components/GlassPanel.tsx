import React, { useEffect, useRef } from 'react';

interface GlassPanelProps {
  children?: React.ReactNode;
  className?: string;
}

const GlassPanel: React.FC<GlassPanelProps> = ({ children, className = '' }) => {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!panelRef.current) return;
    const handle = () => {
      const target = document.activeElement;
      if (!target) return;
      const contains = panelRef.current?.contains(target);
      panelRef.current?.classList.toggle('ring-visible', !!contains);
    };
    window.addEventListener('focusin', handle);
    return () => window.removeEventListener('focusin', handle);
  }, []);

  return (
    <div
      ref={panelRef}
      className={`rounded-[12px] border border-[rgba(18,22,41,0.35)] bg-[rgba(255,255,255,0.08)] backdrop-blur shadow-lg transition ${className}`}
    >
      {children}
    </div>
  );
};

export default GlassPanel;
