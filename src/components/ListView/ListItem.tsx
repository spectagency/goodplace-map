'use client';

import { TagPill } from '@/components/UI';
import type { Podcast } from '@/types';

interface ListItemProps {
  podcast: Podcast;
  onClick: () => void;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

export function ListItem({ podcast, onClick }: ListItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
    >
      {/* Thumbnail */}
      <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
        {podcast.thumbnailUrl ? (
          <img
            src={podcast.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#60977F] text-white font-bold text-2xl">
            G
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 truncate">
          {podcast.title}
        </h3>
        {podcast.description && (
          <p className="text-sm text-gray-600 line-clamp-2 mt-0.5">
            {truncate(podcast.description, 100)}
          </p>
        )}
        {podcast.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {podcast.tags.map((tag) => (
              <TagPill key={tag.id} name={tag.name} size="small" />
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
