'use client';

interface ListHeaderProps {
  onClose: () => void;
  totalCount: number;
  filteredCount: number;
}

export function ListHeader({ onClose, totalCount, filteredCount }: ListHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
      <div className="flex items-center gap-3">
        {/* List icon */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gray-700"
        >
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        <h2 className="text-lg font-bold uppercase tracking-wide text-gray-800">
          List View
        </h2>
      </div>
      {/* Filter icon */}
      <button
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Filter"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gray-600"
        >
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
      </button>
    </div>
  );
}
