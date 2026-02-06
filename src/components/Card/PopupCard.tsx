'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppStore, useSelectedPodcast, useIsCardOpen } from '@/store/useAppStore';
import { CloseButton, TagPill, Button, YouTubeIcon, Overlay } from '@/components/UI';
import { ScrollableDescription } from './ScrollableDescription';

// Card dimensions for pin positioning calculations
export const CARD_MIN_HEIGHT_VH = 40;
export const CARD_MAX_HEIGHT_PX = 560;

function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
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

export function PopupCard() {
  const cardRef = useRef<HTMLDivElement>(null);
  const podcast = useSelectedPodcast();
  const isOpen = useIsCardOpen();
  const { closeCard, card, openListView } = useAppStore();
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle');

  // Generate share URL for the episode (includes /map base path)
  const getShareUrl = () => {
    if (!podcast?.slug) return window.location.origin;
    return `${window.location.origin}/map/episodes/${podcast.slug}`;
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

  // Reset URL to /map when closing card (if opened via direct URL)
  const wasOpenedViaUrlRef = useRef(false);

  useEffect(() => {
    // Check if we're on an episode page on mount
    if (isOpen && window.location.pathname.includes('/episodes/')) {
      wasOpenedViaUrlRef.current = true;
    }
  }, [isOpen]);

  useEffect(() => {
    // When card closes and was opened via URL, redirect to /map
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

  if (!isOpen || !podcast) return null;

  const youtubeEmbedUrl = podcast.youtubeLink
    ? getYouTubeEmbedUrl(podcast.youtubeLink)
    : null;

  const handleBackToList = () => {
    closeCard();
    openListView();
  };

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
              bg-white rounded-[24px]
              shadow-[0_0_10px_rgba(117,117,117,0.25)]
              overflow-hidden flex flex-col p-3
              animate-in fade-in duration-300"
            style={{
              minHeight: `${CARD_MIN_HEIGHT_VH}vh`,
              maxHeight: `${CARD_MAX_HEIGHT_PX}px`
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="card-title"
          >
            {/* Thumbnail/Video section - fixed at top */}
            {podcast.thumbnailUrl ? (
              <div className="relative w-full aspect-video bg-gray-100 flex-shrink-0 rounded-[12px] overflow-hidden">
                <img
                  src={podcast.thumbnailUrl}
                  alt={podcast.title}
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
                  title={podcast.title}
                />
              </div>
            ) : null}

            {/* Middle content section - fills available space */}
            <div className="flex-1 min-h-0 flex flex-col px-2 pt-2">
              {/* Location name */}
              {podcast.locationName && (
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5 flex-shrink-0">
                  {podcast.locationName}
                </p>
              )}

              {/* Title */}
              <h2
                id="card-title"
                className="text-xl font-bold text-gray-900 mt-0 mb-2 flex-shrink-0"
              >
                {podcast.title}
              </h2>

              {/* Tags */}
              {podcast.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3 flex-shrink-0">
                  {podcast.tags.map((tag) => (
                    <TagPill key={tag.id} name={tag.name} />
                  ))}
                </div>
              )}

              {/* Description - scrollable with gradient fade, fills remaining space */}
              {podcast.description && (
                <ScrollableDescription description={podcast.description} />
              )}
            </div>

            {/* Action buttons - fixed at bottom */}
            <div className="flex-shrink-0 px-2 pt-3 pb-1 space-y-2">
              <div className="flex gap-2">
                {podcast.spotifyLink && (
                  <Button href={podcast.spotifyLink} variant="spotify" className="flex-1">
                    Listen on Spotify
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={handleShare}
                  className="px-4"
                  aria-label="Share episode"
                >
                  {shareStatus === 'copied' ? (
                    <span className="text-sm">Copied!</span>
                  ) : (
                    <ShareIcon />
                  )}
                </Button>
              </div>
              {podcast.youtubeLink && !youtubeEmbedUrl && (
                <Button href={podcast.youtubeLink} variant="youtube" fullWidth>
                  <YouTubeIcon />
                  Watch on YouTube
                </Button>
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
