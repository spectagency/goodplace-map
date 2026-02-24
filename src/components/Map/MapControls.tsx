'use client';

import { useAppStore, useActiveContentTypeFilters, useIsListOpen } from '@/store/useAppStore';
import { CONTENT_TYPE_CONFIG, type ContentType } from '@/types';

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

const CONTENT_TYPES: ContentType[] = ['podcast', 'place', 'initiative'];

export function ContentTypeToggle() {
  const activeContentTypeFilters = useActiveContentTypeFilters();
  const isListOpen = useIsListOpen();
  const { toggleContentTypeFilter } = useAppStore();

  if (isListOpen) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
      <div className="flex items-center gap-1 bg-white backdrop-blur-[10px] rounded-full shadow-lg px-1.5 py-1.5">
        {CONTENT_TYPES.map((type) => {
          const config = CONTENT_TYPE_CONFIG[type];
          const isActive =
            activeContentTypeFilters.length === 0 ||
            activeContentTypeFilters.includes(type);

          return (
            <button
              key={type}
              onClick={() => toggleContentTypeFilter(type)}
              className="px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase transition-all"
              style={{
                backgroundColor: isActive ? config.pinColor : `${config.pinColor}15`,
                color: isActive ? 'white' : config.pinColor,
                opacity: isActive ? 1 : 0.4,
              }}
              aria-label={`${isActive ? 'Hide' : 'Show'} ${config.pluralLabel}`}
              aria-pressed={isActive}
            >
              {config.pluralLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
