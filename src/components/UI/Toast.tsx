'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';

export function NotFoundToast() {
  const notFoundMessage = useAppStore((state) => state.card.notFoundMessage);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (notFoundMessage) {
      setShouldRender(true);
      // Small delay to trigger animation
      requestAnimationFrame(() => {
        setIsVisible(true);
      });

      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        // Wait for animation to complete before unmounting
        setTimeout(() => setShouldRender(false), 300);
      }, 5000);

      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      setShouldRender(false);
    }
  }, [notFoundMessage]);

  if (!shouldRender || !notFoundMessage) return null;

  return (
    <div
      className={`
        fixed bottom-6 left-1/2 -translate-x-1/2 z-[60]
        max-w-[90vw] w-auto
        bg-amber-50 border border-amber-200
        rounded-lg shadow-lg px-4 py-3
        transition-all duration-300 ease-out
        ${isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4'
        }
      `}
    >
      <p className="text-sm text-amber-800 text-center">{notFoundMessage}</p>
    </div>
  );
}
