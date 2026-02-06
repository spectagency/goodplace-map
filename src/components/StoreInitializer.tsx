'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { Tag, MapItem } from '@/types';

interface StoreInitializerProps {
  tags: Tag[];
  initialSelectedItem?: MapItem | null;
  showNotFoundMessage?: boolean;
}

const NOT_FOUND_MESSAGE = "Oops, we couldn't find that. Here's one you might enjoy instead!";

export function StoreInitializer({
  tags,
  initialSelectedItem,
  showNotFoundMessage = false,
}: StoreInitializerProps) {
  const setTags = useAppStore((state) => state.setTags);
  const setPendingInitialItem = useAppStore((state) => state.setPendingInitialItem);
  const hasInitializedRef = useRef(false);
  const hasInitializedTagsRef = useRef(false);

  // Initialize tags (only once)
  useEffect(() => {
    if (tags.length > 0 && !hasInitializedTagsRef.current) {
      hasInitializedTagsRef.current = true;
      setTags(tags);
    }
  }, [tags, setTags]);

  // Set pending item for map to pan to first (card opens after pan)
  useEffect(() => {
    if (initialSelectedItem && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      const message = showNotFoundMessage ? NOT_FOUND_MESSAGE : null;
      setPendingInitialItem(initialSelectedItem, message);
    }
  }, [initialSelectedItem, showNotFoundMessage, setPendingInitialItem]);

  return null;
}
