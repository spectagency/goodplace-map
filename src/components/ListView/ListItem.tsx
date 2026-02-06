'use client';

import { TagPill } from '@/components/UI';
import type { MapItem } from '@/types';
import { CONTENT_TYPE_CONFIG } from '@/types';

interface ListItemProps {
  item: MapItem;
  onClick: () => void;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

export function ListItem({ item, onClick }: ListItemProps) {
  const typeConfig = CONTENT_TYPE_CONFIG[item.type];

  return (
    <button
      onClick={onClick}
      className="w-full grid grid-cols-[auto_1fr] gap-3 px-3 py-2 hover:bg-black/5 rounded-lg transition-colors text-left"
      style={{ gridTemplateRows: '1fr' }}
    >
      {/* Thumbnail - square, height matches row */}
      <div className="relative">
        <div
          className="rounded-lg overflow-hidden bg-gray-100"
          style={{ aspectRatio: '1/1', height: '100%' }}
        >
          {item.thumbnailUrl ? (
            <img
              src={item.thumbnailUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-white font-bold text-2xl"
              style={{ backgroundColor: typeConfig.pinColor }}
            >
              {typeConfig.label[0]}
            </div>
          )}
        </div>
        {/* Content type indicator */}
        <div
          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
          style={{ backgroundColor: typeConfig.pinColor }}
          title={typeConfig.label}
        >
          {typeConfig.label[0]}
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0 flex flex-col justify-center py-1">
        <h3 className="text-[1.125em] font-semibold text-gray-900 truncate leading-none">
          {item.title}
        </h3>
        {item.description && (
          <p className="text-[1em] text-gray-600 line-clamp-2 mt-0.5">
            {truncate(item.description, 100)}
          </p>
        )}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {item.tags.map((tag) => (
              <TagPill key={tag.id} name={tag.name} size="small" />
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
