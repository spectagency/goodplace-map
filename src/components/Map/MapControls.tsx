'use client';

import { useAppStore } from '@/store/useAppStore';

export function ListViewToggle() {
  const { toggleListView, listView } = useAppStore();

  return (
    <div className="absolute bottom-4 left-4 z-10">
      <button
        onClick={toggleListView}
        className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow font-medium text-sm"
        aria-label={listView.isOpen ? 'Close list view' : 'Open list view'}
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
        >
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        <span>List View</span>
      </button>
    </div>
  );
}
