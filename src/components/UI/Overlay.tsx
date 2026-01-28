'use client';

import { useEffect } from 'react';

interface OverlayProps {
  isOpen: boolean;
  onClick?: () => void;
  zIndex?: number;
}

export function Overlay({ isOpen, onClick, zIndex = 40 }: OverlayProps) {
  // Prevent body scroll when overlay is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 transition-opacity"
      style={{ zIndex }}
      onClick={onClick}
      aria-hidden="true"
    />
  );
}
