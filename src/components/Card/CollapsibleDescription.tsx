'use client';

import { useState, useRef, useEffect } from 'react';

interface CollapsibleDescriptionProps {
  description: string;
  maxCollapsedLines?: number;
}

export function CollapsibleDescription({
  description,
  maxCollapsedLines = 3,
}: CollapsibleDescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsTruncation, setNeedsTruncation] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      const lineHeight = parseInt(getComputedStyle(contentRef.current).lineHeight) || 24;
      const maxHeight = lineHeight * maxCollapsedLines;
      setNeedsTruncation(contentRef.current.scrollHeight > maxHeight);
    }
  }, [description, maxCollapsedLines]);

  return (
    <div className="relative">
      <div
        ref={contentRef}
        className={`text-sm text-gray-600 leading-relaxed ${
          !isExpanded && needsTruncation ? 'line-clamp-3' : ''
        } ${isExpanded ? 'max-h-48 overflow-y-auto pr-2' : ''}`}
        style={isExpanded ? { maxHeight: '200px' } : undefined}
      >
        {description}
      </div>
      {needsTruncation && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm font-medium text-[#60977F] hover:text-[#4a7a65] mt-1"
        >
          {isExpanded ? 'Show less' : '...Show more'}
        </button>
      )}
    </div>
  );
}
