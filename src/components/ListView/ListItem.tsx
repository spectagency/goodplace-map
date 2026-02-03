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
      className="w-full grid grid-cols-[auto_1fr] gap-3 px-3 py-2 hover:bg-black/5 rounded-lg transition-colors text-left"
      style={{ gridTemplateRows: '1fr' }}
    >
      {/* Thumbnail - square, height matches row */}
      <div
        className="rounded-lg overflow-hidden bg-gray-100"
        style={{ aspectRatio: '1/1', height: '100%' }}
      >
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
      <div className="min-w-0 flex flex-col justify-center py-1">
        <h3 className="text-[1.125em] font-semibold text-gray-900 truncate leading-none">
          {podcast.title}
        </h3>
        {podcast.description && (
          <p className="text-[1em] text-gray-600 line-clamp-2 mt-0.5">
            {truncate(podcast.description, 100)}
          </p>
        )}
        {podcast.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {podcast.tags.map((tag) => (
              <TagPill key={tag.id} name={tag.name} size="small" />
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
