'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAppStore, useAllMapItems } from '@/store/useAppStore';
import { Overlay } from './Overlay';
import { Button } from './Button';

const STORAGE_KEY = 'gp_welcome_seen_at';
const TTL_MS = 24 * 60 * 60 * 1000; // Show again after 1 day

function hasSeenRecently(): boolean {
  try {
    const seenAt = Number(localStorage.getItem(STORAGE_KEY)) || 0;
    return Date.now() - seenAt < TTL_MS;
  } catch {
    // Storage blocked (e.g. Safari in an iframe): show once per page load
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // Ignore — storage unavailable
  }
}

export function WelcomePopup() {
  const [isOpen, setIsOpen] = useState(false);
  const allItems = useAllMapItems();
  const pendingItem = useAppStore((state) => state.initialLoad.pendingItem);
  const isCardOpen = useAppStore((state) => state.card.isOpen);

  // Decide on the client after mount (avoids hydration mismatch)
  useEffect(() => {
    const { initialLoad, card } = useAppStore.getState();
    if (initialLoad.pendingItem || card.isOpen) return; // Arrived via deeplink
    if (!hasSeenRecently()) setIsOpen(true);
  }, []);

  // A deeplink/share navigation arrived later (e.g. via postMessage): get out of the way
  useEffect(() => {
    if (isOpen && (pendingItem || isCardOpen)) setIsOpen(false);
  }, [isOpen, pendingItem, isCardOpen]);

  const close = useCallback(() => {
    markSeen();
    setIsOpen(false);
  }, []);

  const handleRandomPin = () => {
    if (allItems.length === 0) return;
    const item = allItems[Math.floor(Math.random() * allItems.length)];
    close();
    window.dispatchEvent(
      new CustomEvent('pin-click', { detail: { item, fromList: false } })
    );
  };

  // Escape closes
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <>
      <Overlay isOpen={isOpen} zIndex={45} onClick={close} />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className="pointer-events-auto w-[90vw] max-w-[450px]
            bg-white rounded-[16px] sm:rounded-[24px]
            shadow-[0_0_10px_rgba(117,117,117,0.25)]
            p-6 sm:p-8 text-center
            animate-in fade-in duration-300"
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-title"
          aria-describedby="welcome-text"
        >
          <h2
            id="welcome-title"
            className="text-base sm:text-xl font-bold text-gray-900 leading-tight mt-0 mb-2"
          >
            Good citizens make good cities.
          </h2>
          <p id="welcome-text" className="text-base text-gray-700 leading-relaxed mt-0 mb-6">
            We create space for conversations about life, place and belonging. Let&apos;s connect!
          </p>
          <div className="flex flex-col gap-2">
            <Button autoFocus variant="spotify" fullWidth onClick={close}>
              Go to map
            </Button>
            {allItems.length > 0 && (
              <Button variant="secondary" fullWidth onClick={handleRandomPin}>
                View random pin
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
