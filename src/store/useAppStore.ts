import { create } from 'zustand';
import type { AppStore, Podcast, Tag, MapBounds } from '@/types';

// Default map center: Netherlands
const DEFAULT_CENTER: [number, number] = [5.1214, 52.0907];
const DEFAULT_ZOOM = 7;

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state - Data
  podcasts: [],
  tags: [],
  isLoading: true,
  error: null,

  // Initial state - Map
  map: {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    bounds: null,
    isLocked: false,
  },

  // Initial state - Card
  card: {
    selectedPodcast: null,
    isOpen: false,
    openedFromList: false,
    isDescriptionExpanded: false,
    notFoundMessage: null,
  },

  // Initial state - List View
  listView: {
    isOpen: false,
    scrollPosition: 0,
    activeTagFilters: [],
  },

  // Initial state - Initial Load (for URL-based navigation)
  initialLoad: {
    pendingPodcast: null,
    pendingNotFoundMessage: null,
  },

  // Data actions
  setPodcasts: (podcasts: Podcast[]) => set({ podcasts, isLoading: false }),

  setTags: (tags: Tag[]) => set({ tags }),

  setLoading: (isLoading: boolean) => set({ isLoading }),

  setError: (error: string | null) => set({ error, isLoading: false }),

  // Map actions
  setMapCenter: (center: [number, number]) =>
    set((state) => ({ map: { ...state.map, center } })),

  setMapZoom: (zoom: number) =>
    set((state) => ({ map: { ...state.map, zoom } })),

  setMapBounds: (bounds: MapBounds | null) =>
    set((state) => ({ map: { ...state.map, bounds } })),

  setMapLocked: (isLocked: boolean) =>
    set((state) => ({ map: { ...state.map, isLocked } })),

  // Card actions
  openCard: (podcast: Podcast, fromList: boolean = false, notFoundMessage: string | null = null) =>
    set({
      card: {
        selectedPodcast: podcast,
        isOpen: true,
        openedFromList: fromList,
        isDescriptionExpanded: false,
        notFoundMessage,
      },
      map: { ...get().map, isLocked: true },
    }),

  closeCard: () =>
    set({
      card: {
        selectedPodcast: null,
        isOpen: false,
        openedFromList: false,
        isDescriptionExpanded: false,
        notFoundMessage: null,
      },
      map: { ...get().map, isLocked: false },
    }),

  toggleDescriptionExpanded: () =>
    set((state) => ({
      card: {
        ...state.card,
        isDescriptionExpanded: !state.card.isDescriptionExpanded,
      },
    })),

  // Initial load actions (for URL-based navigation - pan first, then open card)
  setPendingInitialPodcast: (podcast: Podcast, notFoundMessage: string | null = null) =>
    set({
      initialLoad: {
        pendingPodcast: podcast,
        pendingNotFoundMessage: notFoundMessage,
      },
    }),

  clearPendingInitialPodcast: () =>
    set({
      initialLoad: {
        pendingPodcast: null,
        pendingNotFoundMessage: null,
      },
    }),

  // List view actions
  openListView: () =>
    set((state) => ({
      listView: { ...state.listView, isOpen: true },
      map: { ...state.map, isLocked: true },
    })),

  closeListView: () =>
    set((state) => ({
      listView: { ...state.listView, isOpen: false },
      map: { ...state.map, isLocked: false },
    })),

  toggleListView: () => {
    const { listView } = get();
    if (listView.isOpen) {
      get().closeListView();
    } else {
      get().openListView();
    }
  },

  setTagFilters: (activeTagFilters: string[]) =>
    set((state) => ({
      listView: { ...state.listView, activeTagFilters },
    })),

  toggleTagFilter: (tagId: string) =>
    set((state) => {
      const { activeTagFilters } = state.listView;
      const newFilters = activeTagFilters.includes(tagId)
        ? activeTagFilters.filter((id) => id !== tagId)
        : [...activeTagFilters, tagId];
      return {
        listView: { ...state.listView, activeTagFilters: newFilters },
      };
    }),

  clearTagFilters: () =>
    set((state) => ({
      listView: { ...state.listView, activeTagFilters: [] },
    })),

  saveListScrollPosition: (scrollPosition: number) =>
    set((state) => ({
      listView: { ...state.listView, scrollPosition },
    })),
}));

// Selector hooks for common derived state
export const useFilteredPodcasts = () => {
  const { podcasts, listView } = useAppStore();
  const { activeTagFilters } = listView;

  if (activeTagFilters.length === 0) {
    return podcasts;
  }

  return podcasts.filter((podcast) =>
    podcast.tags.some((tag) => activeTagFilters.includes(tag.id))
  );
};

export const useSelectedPodcast = () => useAppStore((state) => state.card.selectedPodcast);
export const useIsCardOpen = () => useAppStore((state) => state.card.isOpen);
export const useIsListOpen = () => useAppStore((state) => state.listView.isOpen);
export const useActiveTagFilters = () => useAppStore((state) => state.listView.activeTagFilters);
export const useIsMapLocked = () => useAppStore((state) => state.map.isLocked);
export const usePendingInitialPodcast = () => useAppStore((state) => state.initialLoad.pendingPodcast);
export const usePendingNotFoundMessage = () => useAppStore((state) => state.initialLoad.pendingNotFoundMessage);
