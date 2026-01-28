'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { Tag, Podcast } from '@/types';

interface StoreInitializerProps {
  tags: Tag[];
  initialSelectedPodcast?: Podcast | null;
  showNotFoundMessage?: boolean;
}

const NOT_FOUND_MESSAGE = "Oops, we couldn't find that episode. Here's one you might enjoy instead!";

export function StoreInitializer({
  tags,
  initialSelectedPodcast,
  showNotFoundMessage = false,
}: StoreInitializerProps) {
  const setTags = useAppStore((state) => state.setTags);
  const setPendingInitialPodcast = useAppStore((state) => state.setPendingInitialPodcast);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (tags.length > 0) {
      setTags(tags);
    }
  }, [tags, setTags]);

  // Set pending podcast for map to pan to first (card opens after pan)
  useEffect(() => {
    if (initialSelectedPodcast && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      const message = showNotFoundMessage ? NOT_FOUND_MESSAGE : null;
      setPendingInitialPodcast(initialSelectedPodcast, message);
    }
  }, [initialSelectedPodcast, showNotFoundMessage, setPendingInitialPodcast]);

  return null;
}
