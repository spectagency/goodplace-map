'use client';

import { useAppStore } from '@/store/useAppStore';

export function ListViewToggle() {
  const { toggleListView, openListView, listView } = useAppStore();

  return (
    <div className="absolute bottom-4 left-4 z-10">
      <div className="flex flex-col rounded-full shadow-lg overflow-hidden">
        {/* Filter button - opens list view with filters expanded */}
        <button
          onClick={() => openListView(true)}
          className="flex items-center justify-center w-14 h-14 bg-[#60977F] hover:bg-[#4a7a65] transition-colors"
          aria-label="Filter"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFE879"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
        </button>
        {/* Divider */}
        <div className="h-px bg-[#4a7a65]" />
        {/* List view button */}
        <button
          onClick={toggleListView}
          className="flex items-center justify-center w-14 h-14 bg-[#60977F] hover:bg-[#4a7a65] transition-colors"
          aria-label={listView.isOpen ? 'Close list view' : 'Open list view'}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFE879"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
