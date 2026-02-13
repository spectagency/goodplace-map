'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppStore, useSelectedItem, useIsCardOpen } from '@/store/useAppStore';
import { CloseButton, TagPill, Button, YouTubeIcon, Overlay } from '@/components/UI';
import { isPodcast, isPlace, isEvent, CONTENT_TYPE_CONFIG } from '@/types';
import type { MapItem, Podcast, Place, Event } from '@/types';

// Card dimensions for pin positioning calculations
export const CARD_MAX_HEIGHT_VH = 80;

function getYouTubeEmbedUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/);
  if (match) {
    return `https://www.youtube.com/embed/${match[1]}`;
  }
  return null;
}

function ShareIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function WebsiteIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function PlaylistIcon() {
  return (
    <svg
      width="18"
      height="18"
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
  );
}

function RouteIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8c0-2.2-1.8-4-4-4-2.2 0-4 1.8-4 4 0 2.2 4 8 4 8s4-5.8 4-8z" />
      <circle cx="14" cy="8" r="1" />
      <path d="M10 16c-4 0-6 1.3-6 3s2 3 6 3h4c4 0 6-1.3 6-3" />
    </svg>
  );
}

// Format event date for display
function formatEventDate(dateString: string | null): string | null {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function PopupCard() {
  const cardRef = useRef<HTMLDivElement>(null);
  const item = useSelectedItem();
  const isOpen = useIsCardOpen();
  const { closeCard, card, openListView } = useAppStore();
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle');

  // Generate share URL with ?share= query param
  // In iframe: use parent origin (e.g. goodplace.com?share=stories/slug)
  // Direct access: use own origin + basePath (e.g. goodplace-map.webflow.io/map?share=stories/slug)
  const getShareUrl = () => {
    if (!item?.slug) return '';
    const config = CONTENT_TYPE_CONFIG[item.type];
    const shareParam = `share=${config.sharePathPrefix}/${item.slug}`;

    // Try to use parent origin when embedded in iframe
    try {
      if (window.parent !== window) {
        return `${window.parent.location.origin}?${shareParam}`;
      }
    } catch {
      // Cross-origin iframe — can't read parent origin
    }

    // Direct access: include /map basePath
    return `${window.location.origin}/map?${shareParam}`;
  };

  // Handle share button click - copy to clipboard
  const handleShare = async () => {
    const shareUrl = getShareUrl();
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus('copied');
      setTimeout(() => setShareStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  // Reset URL to /map when closing card (if opened via direct URL or query params)
  const wasOpenedViaUrlRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      const hasSlugParam = new URLSearchParams(window.location.search).has('slug');
      const isContentRoute =
        window.location.pathname.includes('/episodes/') ||
        window.location.pathname.includes('/places/') ||
        window.location.pathname.includes('/events/');
      if (hasSlugParam || isContentRoute) {
        wasOpenedViaUrlRef.current = true;
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen && wasOpenedViaUrlRef.current) {
      wasOpenedViaUrlRef.current = false;
      window.history.replaceState({}, '', '/map');
    }
  }, [isOpen]);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        closeCard();
      }
    };

    // Delay to prevent immediate close on open
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, closeCard]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeCard();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeCard]);

  if (!isOpen || !item) return null;

  const handleBackToList = () => {
    closeCard();
    openListView();
  };

  // Get type-specific values
  const typeConfig = CONTENT_TYPE_CONFIG[item.type];
  // Get YouTube embed URL for podcasts and events
  const youtubeEmbedUrl = (isPodcast(item) || isEvent(item)) && item.youtubeLink
    ? getYouTubeEmbedUrl(item.youtubeLink)
    : null;

  return (
    <>
      <Overlay isOpen={isOpen} zIndex={45} />
      {/* Flexbox wrapper for reliable centering */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        {/* Wrapper for card + external close button */}
        <div ref={cardRef} className="relative pointer-events-auto">
          {/* Close button outside card */}
          <CloseButton
            onClick={closeCard}
            variant="overlay"
            className="absolute -top-3 -right-3 z-10"
          />
          <div
            className="w-[90vw] max-w-[450px]
              max-h-[calc(100vh-64px)] sm:max-h-[80vh]
              bg-white rounded-[24px]
              shadow-[0_0_10px_rgba(117,117,117,0.25)]
              overflow-hidden flex flex-col p-3
              animate-in fade-in duration-300"
            role="dialog"
            aria-modal="true"
            aria-labelledby="card-title"
          >
            {/* Thumbnail/Video section - fixed at top */}
            {item.thumbnailUrl ? (
              <div className="relative w-full aspect-video bg-gray-100 flex-shrink-0 rounded-[12px] overflow-hidden">
                <img
                  src={item.thumbnailUrl}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : youtubeEmbedUrl ? (
              <div className="relative w-full aspect-video bg-gray-100 flex-shrink-0 rounded-[12px] overflow-hidden">
                <iframe
                  src={youtubeEmbedUrl}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={item.title}
                />
              </div>
            ) : null}

            {/* Middle content section - scrollable when it overflows */}
            <div className="flex-1 min-h-0 overflow-y-auto px-2 pt-2">
              {/* Content type badge + Location name */}
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: `${typeConfig.pinColor}20`,
                    color: typeConfig.pinColor,
                  }}
                >
                  {typeConfig.label}
                </span>
                {item.locationName && (
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    {item.locationName}
                  </p>
                )}
              </div>

              {/* Title */}
              <h2
                id="card-title"
                className="text-base sm:text-xl font-bold text-gray-900 mt-0 mb-2"
              >
                {item.title}
              </h2>

              {/* Event date (for events) */}
              {isEvent(item) && item.eventDate && (
                <p className="text-sm text-gray-600 mb-2 flex items-center gap-1.5">
                  <CalendarIcon />
                  {formatEventDate(item.eventDate)}
                </p>
              )}

              {/* Address (for places) */}
              {isPlace(item) && item.address && (
                <p className="text-sm text-gray-600 mb-2">
                  📍 {item.address}
                </p>
              )}

              {/* Tags */}
              {item.tags.length > 0 && (
                <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-hide">
                  {item.tags.map((tag) => (
                    <TagPill key={tag.id} name={tag.name} />
                  ))}
                </div>
              )}

              {/* Description - full text, scrolls with the content above */}
              {item.description && (
                <p className="text-sm text-gray-600 leading-relaxed mb-2">
                  {item.description}
                </p>
              )}
            </div>

            {/* Action buttons - fixed at bottom (type-specific) */}
            <div className="flex-shrink-0 px-2 pt-3 pb-1 space-y-2">
              {/* Podcast actions */}
              {isPodcast(item) && (
                <>
                  <div className="flex gap-2">
                    {item.spotifyLink && (
                      <Button href={item.spotifyLink} variant="spotify" className="flex-1">
                        Listen on Spotify
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      onClick={handleShare}
                      className="w-11 h-11 !p-0"
                      aria-label="Share"
                    >
                      {shareStatus === 'copied' ? (
                        <span className="text-xs">Copied!</span>
                      ) : (
                        <ShareIcon />
                      )}
                    </Button>
                  </div>
                  {item.youtubeLink && !youtubeEmbedUrl && (
                    <Button href={item.youtubeLink} variant="youtube" fullWidth>
                      <YouTubeIcon />
                      Watch on YouTube
                    </Button>
                  )}
                </>
              )}

              {/* Place actions */}
              {isPlace(item) && (
                <div className="flex gap-2">
                  {item.websiteUrl && (
                    <Button href={item.websiteUrl} variant="spotify" className="flex-1">
                      <WebsiteIcon />
                      Visit Website
                    </Button>
                  )}
                  <Button
                    href={`https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`}
                    variant="secondary"
                    className="w-11 h-11 !p-0"
                    aria-label="Get directions"
                    title="Get directions"
                  >
                    <RouteIcon />
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleShare}
                    className="w-11 h-11 !p-0"
                    aria-label="Share"
                  >
                    {shareStatus === 'copied' ? (
                      <span className="text-xs">Copied!</span>
                    ) : (
                      <ShareIcon />
                    )}
                  </Button>
                </div>
              )}

              {/* Event actions */}
              {isEvent(item) && (
                <div className="flex gap-2">
                  {item.playlistLink && (
                    <Button href={item.playlistLink} variant="spotify" className="flex-1">
                      Watch Full Playlist
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    onClick={handleShare}
                    className="w-11 h-11 !p-0"
                    aria-label="Share"
                  >
                    {shareStatus === 'copied' ? (
                      <span className="text-xs">Copied!</span>
                    ) : (
                      <ShareIcon />
                    )}
                  </Button>
                </div>
              )}

              {/* Back to list button */}
              {card.openedFromList && (
                <button
                  onClick={handleBackToList}
                  className="mt-2 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                  Back to list
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
