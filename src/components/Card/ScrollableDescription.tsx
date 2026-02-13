'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface ScrollableDescriptionProps {
  description: string;
}

export function ScrollableDescription({ description }: ScrollableDescriptionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showGradient, setShowGradient] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);

  // Check if content overflows and needs scrolling
  const checkOverflow = useCallback(() => {
    if (containerRef.current) {
      const { scrollHeight, clientHeight } = containerRef.current;
      const hasOverflow = scrollHeight > clientHeight;
      setIsScrollable(hasOverflow);
      // Show gradient only if scrollable and not at bottom
      if (hasOverflow) {
        const { scrollTop } = containerRef.current;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 2;
        setShowGradient(!isAtBottom);
      } else {
        setShowGradient(false);
      }
    }
  }, []);

  // Check overflow on mount and when description changes
  useEffect(() => {
    // Use RAF to ensure layout is complete before checking
    const rafId = requestAnimationFrame(() => {
      checkOverflow();
    });
    // Also check on resize since parent container size might change
    window.addEventListener('resize', checkOverflow);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', checkOverflow);
    };
  }, [description, checkOverflow]);

  // Handle scroll to update gradient visibility
  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 2;
      setShowGradient(!isAtBottom);
    }
  };

  return (
    <div className="relative flex-1 min-h-[80px] overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="text-sm text-gray-600 leading-relaxed overflow-y-auto absolute inset-0 pr-1"
      >
        {description}
      </div>
      {/* Gradient overlay at bottom - only shows when scrollable and not at bottom */}
      {isScrollable && showGradient && (
        <div
          className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.95))',
          }}
        />
      )}
    </div>
  );
}
