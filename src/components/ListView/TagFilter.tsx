'use client';

import { useAppStore, useActiveTagFilters, useActiveContentTypeFilters } from '@/store/useAppStore';
import type { Tag, ContentType } from '@/types';
import { CONTENT_TYPE_CONFIG } from '@/types';

interface TagFilterProps {
  tags: Tag[];
}

const CONTENT_TYPES: ContentType[] = ['podcast', 'place', 'initiative'];

export function TagFilter({ tags }: TagFilterProps) {
  const activeTagFilters = useActiveTagFilters();
  const activeContentTypeFilters = useActiveContentTypeFilters();
  const { podcasts, places, initiatives } = useAppStore();
  const {
    toggleTagFilter,
    clearTagFilters,
    toggleContentTypeFilter,
    clearContentTypeFilters,
  } = useAppStore();

  // Only show tags that are actually used by at least one item (of the selected types, or all)
  const visibleTags = (() => {
    const usedTagIds = new Set<string>();
    const filterPodcasts = activeContentTypeFilters.length === 0 || activeContentTypeFilters.includes('podcast');
    const filterPlaces = activeContentTypeFilters.length === 0 || activeContentTypeFilters.includes('place');
    const filterInitiatives = activeContentTypeFilters.length === 0 || activeContentTypeFilters.includes('initiative');
    if (filterPodcasts) podcasts.forEach((p) => p.tags.forEach((t) => usedTagIds.add(t.id)));
    if (filterPlaces) places.forEach((p) => p.tags.forEach((t) => usedTagIds.add(t.id)));
    if (filterInitiatives) initiatives.forEach((i) => i.tags.forEach((t) => usedTagIds.add(t.id)));
    return tags.filter((tag) => usedTagIds.has(tag.id));
  })();

  const clearAllFilters = () => {
    clearTagFilters();
    clearContentTypeFilters();
  };

  return (
    <div className="px-4 py-3 border-b border-black/10 space-y-3">
      {/* Content type filters */}
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Type
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={clearContentTypeFilters}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium uppercase transition-colors ${
              activeContentTypeFilters.length === 0
                ? 'bg-gray-800 text-white'
                : 'bg-black/5 text-gray-600 hover:bg-black/10'
            }`}
          >
            All Types
          </button>
          {CONTENT_TYPES.map((type) => {
            const config = CONTENT_TYPE_CONFIG[type];
            const isActive = activeContentTypeFilters.includes(type);
            return (
              <button
                key={type}
                onClick={() => toggleContentTypeFilter(type)}
                className="shrink-0 px-3 py-1.5 rounded-full text-sm font-medium uppercase transition-colors"
                style={{
                  backgroundColor: isActive ? config.pinColor : `${config.pinColor}15`,
                  color: isActive ? 'white' : config.pinColor,
                }}
              >
                {config.pluralLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tag filters */}
      {visibleTags.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Tags
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={clearAllFilters}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium uppercase transition-colors ${
                activeTagFilters.length === 0 && activeContentTypeFilters.length === 0
                  ? 'bg-gray-800 text-white'
                  : 'bg-black/5 text-gray-600 hover:bg-black/10'
              }`}
            >
              All
            </button>
            {visibleTags.map((tag) => {
              const isActive = activeTagFilters.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTagFilter(tag.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium uppercase transition-colors ${
                    isActive
                      ? 'bg-gray-800 text-white'
                      : 'bg-black/5 text-gray-600 hover:bg-black/10'
                  }`}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
