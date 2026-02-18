import { create } from 'zustand';
import type {
  AppStore,
  Podcast,
  Place,
  Event,
  MapItem,
  Tag,
  MapBounds,
  ContentType
} from '@/types';

// Default map center: Netherlands
const DEFAULT_CENTER: [number, number] = [5.1214, 52.0907];
const DEFAULT_ZOOM = 7;

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state - Data
  podcasts: [],
  places: [],
  events: [],
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
    selectedItem: null,
    isOpen: false,
    openedFromList: false,
    isDescriptionExpanded: false,
    notFoundMessage: null,
  },

  // Initial state - List View
  listView: {
    isOpen: false,
    isFilterOpen: false,
    scrollPosition: 0,
    activeTagFilters: [],
    activeContentTypeFilters: [],
  },

  // Initial state - Initial Load (for URL-based navigation)
  initialLoad: {
    pendingItem: null,
    pendingNotFoundMessage: null,
  },

  // Parent origin (for share URLs when embedded in iframe)
  parentOrigin: null,

  // Data actions
  setPodcasts: (podcasts: Podcast[]) => set({ podcasts, isLoading: false }),

  setPlaces: (places: Place[]) => set({ places }),

  setEvents: (events: Event[]) => set({ events }),

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
  openCard: (item: MapItem, fromList: boolean = false, notFoundMessage: string | null = null) =>
    set({
      card: {
        selectedItem: item,
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
        selectedItem: null,
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
  setPendingInitialItem: (item: MapItem, notFoundMessage: string | null = null) =>
    set({
      initialLoad: {
        pendingItem: item,
        pendingNotFoundMessage: notFoundMessage,
      },
    }),

  clearPendingInitialItem: () =>
    set({
      initialLoad: {
        pendingItem: null,
        pendingNotFoundMessage: null,
      },
    }),

  // Parent origin action
  setParentOrigin: (origin: string) => set({ parentOrigin: origin }),

  // List view actions
  openListView: (withFilters = false) =>
    set((state) => ({
      listView: { ...state.listView, isOpen: true, isFilterOpen: withFilters },
      map: { ...state.map, isLocked: true },
    })),

  closeListView: () =>
    set((state) => ({
      listView: { ...state.listView, isOpen: false, isFilterOpen: false },
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

  setContentTypeFilters: (activeContentTypeFilters: ContentType[]) =>
    set((state) => ({
      listView: { ...state.listView, activeContentTypeFilters },
    })),

  toggleContentTypeFilter: (type: ContentType) =>
    set((state) => {
      const { activeContentTypeFilters } = state.listView;
      const newFilters = activeContentTypeFilters.includes(type)
        ? activeContentTypeFilters.filter((t) => t !== type)
        : [...activeContentTypeFilters, type];
      return {
        listView: { ...state.listView, activeContentTypeFilters: newFilters },
      };
    }),

  clearContentTypeFilters: () =>
    set((state) => ({
      listView: { ...state.listView, activeContentTypeFilters: [] },
    })),

  saveListScrollPosition: (scrollPosition: number) =>
    set((state) => ({
      listView: { ...state.listView, scrollPosition },
    })),
}));

// ============================================
// Selector hooks for common derived state
// ============================================

// Get all map items combined
export const useAllMapItems = () => {
  const { podcasts, places, events } = useAppStore();
  return [...podcasts, ...places, ...events] as MapItem[];
};

// Filter items by tags
const filterByTags = (items: MapItem[], tagFilters: string[]): MapItem[] => {
  if (tagFilters.length === 0) return items;
  return items.filter((item) =>
    item.tags.some((tag) => tagFilters.includes(tag.id))
  );
};

// Filter items by content type
const filterByContentType = (items: MapItem[], typeFilters: ContentType[]): MapItem[] => {
  if (typeFilters.length === 0) return items;
  return items.filter((item) => typeFilters.includes(item.type));
};

// Get filtered map items (by both tags and content type)
export const useFilteredMapItems = () => {
  const { podcasts, places, events, listView } = useAppStore();
  const { activeTagFilters, activeContentTypeFilters } = listView;

  let items: MapItem[] = [...podcasts, ...places, ...events];

  // Filter by content type first
  items = filterByContentType(items, activeContentTypeFilters);

  // Then filter by tags
  items = filterByTags(items, activeTagFilters);

  return items;
};

// Get filtered podcasts only (for backward compatibility)
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

// Get filtered places only
export const useFilteredPlaces = () => {
  const { places, listView } = useAppStore();
  const { activeTagFilters } = listView;

  if (activeTagFilters.length === 0) {
    return places;
  }

  return places.filter((place) =>
    place.tags.some((tag) => activeTagFilters.includes(tag.id))
  );
};

// Get filtered events only
export const useFilteredEvents = () => {
  const { events, listView } = useAppStore();
  const { activeTagFilters } = listView;

  if (activeTagFilters.length === 0) {
    return events;
  }

  return events.filter((event) =>
    event.tags.some((tag) => activeTagFilters.includes(tag.id))
  );
};

// Selected item (can be any content type)
export const useSelectedItem = () => useAppStore((state) => state.card.selectedItem);

// For backward compatibility - returns selected item if it's a podcast
export const useSelectedPodcast = () => {
  const selectedItem = useAppStore((state) => state.card.selectedItem);
  return selectedItem?.type === 'podcast' ? selectedItem as Podcast : null;
};

export const useIsCardOpen = () => useAppStore((state) => state.card.isOpen);
export const useIsListOpen = () => useAppStore((state) => state.listView.isOpen);
export const useActiveTagFilters = () => useAppStore((state) => state.listView.activeTagFilters);
export const useActiveContentTypeFilters = () => useAppStore((state) => state.listView.activeContentTypeFilters);
export const useIsMapLocked = () => useAppStore((state) => state.map.isLocked);

// Pending initial item (for URL-based navigation)
export const usePendingInitialItem = () => useAppStore((state) => state.initialLoad.pendingItem);
export const usePendingNotFoundMessage = () => useAppStore((state) => state.initialLoad.pendingNotFoundMessage);

// For backward compatibility
export const usePendingInitialPodcast = () => {
  const pendingItem = useAppStore((state) => state.initialLoad.pendingItem);
  return pendingItem?.type === 'podcast' ? pendingItem as Podcast : pendingItem;
};
