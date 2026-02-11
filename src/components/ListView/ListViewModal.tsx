'use client';

import { useRef, useEffect } from 'react';
import { useAppStore, useIsListOpen, useFilteredMapItems, useAllMapItems } from '@/store/useAppStore';
import { ListHeader } from './ListHeader';
import { TagFilter } from './TagFilter';
import { ListItem } from './ListItem';
import type { MapItem } from '@/types';

export function ListViewModal() {
  const listRef = useRef<HTMLDivElement>(null);
  const isOpen = useIsListOpen();
  const filteredItems = useFilteredMapItems();
  const allItems = useAllMapItems();
  const {
    tags,
    closeListView,
    openCard,
    saveListScrollPosition,
    listView,
  } = useAppStore();
  const isFilterOpen = listView.isFilterOpen;
  const setIsFilterOpen = (open: boolean) =>
    useAppStore.setState((state) => ({
      listView: { ...state.listView, isFilterOpen: open },
    }));

  // Restore scroll position when reopening
  useEffect(() => {
    if (isOpen && listRef.current && listView.scrollPosition > 0) {
      listRef.current.scrollTop = listView.scrollPosition;
    }
  }, [isOpen, listView.scrollPosition]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeListView();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeListView]);

  const handleItemClick = (item: MapItem) => {
    // Save scroll position
    if (listRef.current) {
      saveListScrollPosition(listRef.current.scrollTop);
    }

    // Close list and open card
    closeListView();
    openCard(item, true);

    // Fly to location
    const mapRef = (window as any).__goodPlaceMap;
    if (mapRef?.flyTo) {
      mapRef.flyTo(item.longitude, item.latitude, 14);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Click-outside area to close */}
      <div
        className="fixed inset-0 z-30"
        onClick={closeListView}
        aria-hidden="true"
      />

      {/* Centered panel */}
      <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
        <div
          className="pointer-events-auto
            w-[90vw] max-w-[550px] h-[85vh]
            bg-white/80 backdrop-blur-[10px] rounded-[24px]
            shadow-[0_0_10px_rgba(117,117,117,0.25)]
            overflow-hidden flex flex-col
            animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Content list"
        >
          <ListHeader
            onClose={closeListView}
            totalCount={allItems.length}
            filteredCount={filteredItems.length}
            onFilterToggle={() => setIsFilterOpen(!isFilterOpen)}
            isFilterOpen={isFilterOpen}
          />

          {isFilterOpen && <TagFilter tags={tags} />}

          <div
            ref={listRef}
            className="flex-1 overflow-y-auto p-3"
          >
            {filteredItems.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-500">
                No items match your filters
              </div>
            ) : (
              <div className="space-y-0">
                {filteredItems.map((item) => (
                  <ListItem
                    key={item.id}
                    item={item}
                    onClick={() => handleItemClick(item)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
