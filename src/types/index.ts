// Content type discriminator
export type ContentType = 'podcast' | 'place' | 'event';

// Content type configuration (for UI)
export const CONTENT_TYPE_CONFIG: Record<ContentType, {
  label: string;
  pluralLabel: string;
  pinColor: string;
  sharePathPrefix: string;
}> = {
  podcast: {
    label: 'Story',
    pluralLabel: 'Stories',
    pinColor: '#60977F', // Green
    sharePathPrefix: 'stories',
  },
  place: {
    label: 'Place',
    pluralLabel: 'Places',
    pinColor: '#FFE879', // Yellow
    sharePathPrefix: 'places',
  },
  event: {
    label: 'Project',
    pluralLabel: 'Projects',
    pinColor: '#5B9BD5', // Blue
    sharePathPrefix: 'projects',
  },
};

// Data types
export interface Tag {
  id: string;
  name: string;
  slug: string | null;
}

// Base interface for all map items
export interface MapItemBase {
  id: string;
  webflowItemId: string;
  type: ContentType;
  title: string;
  slug: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  latitude: number;
  longitude: number;
  locationName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  tags: Tag[];
}

// Podcast - episodes with audio/video content
export interface Podcast extends MapItemBase {
  type: 'podcast';
  youtubeLink: string | null;
  spotifyLink: string | null;
  publishedAt: string | null;
}

// Place - featured locations (cafes, venues, etc.)
export interface Place extends MapItemBase {
  type: 'place';
  address: string | null;
  websiteUrl: string | null;
  openingHours: string | null;
}

// Event - past events with video and playlist
export interface Event extends MapItemBase {
  type: 'event';
  eventDate: string | null;
  endDate: string | null;
  youtubeLink: string | null; // Video embed link
  playlistLink: string | null; // YouTube playlist link
}

// Union type for any map item
export type MapItem = Podcast | Place | Event;

// Type guard functions
export function isPodcast(item: MapItem): item is Podcast {
  return item.type === 'podcast';
}

export function isPlace(item: MapItem): item is Place {
  return item.type === 'place';
}

export function isEvent(item: MapItem): item is Event {
  return item.type === 'event';
}

// Map types
export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapState {
  center: [number, number]; // [lng, lat]
  zoom: number;
  bounds: MapBounds | null;
  isLocked: boolean;
}

// Card types
export interface CardState {
  selectedItem: MapItem | null;
  isOpen: boolean;
  openedFromList: boolean;
  isDescriptionExpanded: boolean;
  notFoundMessage: string | null; // Message to show when item wasn't found
}

// Initial load state (for URL-based item loading)
export interface InitialLoadState {
  pendingItem: MapItem | null; // Item to pan to before opening card
  pendingNotFoundMessage: string | null;
}

// List view types
export interface ListViewState {
  isOpen: boolean;
  isFilterOpen: boolean;
  scrollPosition: number;
  activeTagFilters: string[];
  activeContentTypeFilters: ContentType[]; // Filter by content type
}

// App state combining all
export interface AppState {
  // Data - separate arrays for each content type
  podcasts: Podcast[];
  places: Place[];
  events: Event[];
  tags: Tag[];
  isLoading: boolean;
  error: string | null;

  // Map
  map: MapState;

  // Card
  card: CardState;

  // List View
  listView: ListViewState;

  // Initial Load (for URL-based navigation)
  initialLoad: InitialLoadState;
}

// Action types for the store
export interface AppActions {
  // Data actions
  setPodcasts: (podcasts: Podcast[]) => void;
  setPlaces: (places: Place[]) => void;
  setEvents: (events: Event[]) => void;
  setTags: (tags: Tag[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Map actions
  setMapCenter: (center: [number, number]) => void;
  setMapZoom: (zoom: number) => void;
  setMapBounds: (bounds: MapBounds | null) => void;
  setMapLocked: (locked: boolean) => void;

  // Card actions
  openCard: (item: MapItem, fromList?: boolean, notFoundMessage?: string | null) => void;
  closeCard: () => void;
  toggleDescriptionExpanded: () => void;

  // Initial load actions (for URL-based navigation - pan first, then open)
  setPendingInitialItem: (item: MapItem, notFoundMessage?: string | null) => void;
  clearPendingInitialItem: () => void;

  // List view actions
  openListView: (withFilters?: boolean) => void;
  closeListView: () => void;
  toggleListView: () => void;
  setTagFilters: (filters: string[]) => void;
  toggleTagFilter: (tagId: string) => void;
  clearTagFilters: () => void;
  setContentTypeFilters: (filters: ContentType[]) => void;
  toggleContentTypeFilter: (type: ContentType) => void;
  clearContentTypeFilters: () => void;
  saveListScrollPosition: (position: number) => void;
}

export type AppStore = AppState & AppActions;

// Utility type for item with coordinates as tuple
export type MapItemCoordinates = Pick<MapItem, 'id' | 'latitude' | 'longitude' | 'type'>;

// Cluster types for supercluster
export interface ClusterProperties {
  cluster: boolean;
  cluster_id?: number;
  point_count?: number;
  point_count_abbreviated?: string | number;
  itemId?: string;
  itemType?: ContentType;
}

export interface MapFeature {
  type: 'Feature';
  properties: ClusterProperties;
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
}
