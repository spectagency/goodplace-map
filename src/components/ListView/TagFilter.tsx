'use client';

import { useAppStore, useActiveTagFilters } from '@/store/useAppStore';
import type { Tag } from '@/types';

interface TagFilterProps {
  tags: Tag[];
}

export function TagFilter({ tags }: TagFilterProps) {
  const activeFilters = useActiveTagFilters();
  const { toggleTagFilter, clearTagFilters } = useAppStore();

  if (tags.length === 0) return null;

  return (
    <div className="px-4 py-3 border-b border-black/10">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={clearTagFilters}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            activeFilters.length === 0
              ? 'bg-[#60977F] text-white'
              : 'bg-black/5 text-gray-600 hover:bg-black/10'
          }`}
        >
          All
        </button>
        {tags.map((tag) => {
          const isActive = activeFilters.includes(tag.id);
          return (
            <button
              key={tag.id}
              onClick={() => toggleTagFilter(tag.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#60977F] text-white'
                  : 'bg-black/5 text-gray-600 hover:bg-black/10'
              }`}
            >
              {tag.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
