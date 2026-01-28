// Data types
export interface Tag {
  id: string;
  name: string;
  slug: string | null;
}

export interface Podcast {
  id: string;
  webflowItemId: string;
  title: string;
  slug: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  youtubeLink: string | null;
  spotifyLink: string | null;
  latitude: number;
  longitude: number;
  locationName: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  tags: Tag[];
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
  selectedPodcast: Podcast | null;
  isOpen: boolean;
  openedFromList: boolean;
  isDescriptionExpanded: boolean;
  notFoundMessage: string | null; // Message to show when episode wasn't found
}

// Initial load state (for URL-based episode loading)
export interface InitialLoadState {
  pendingPodcast: Podcast | null; // Podcast to pan to before opening card
  pendingNotFoundMessage: string | null;
}

// List view types
export interface ListViewState {
  isOpen: boolean;
  scrollPosition: number;
  activeTagFilters: string[];
}

// App state combining all
export interface AppState {
  // Data
  podcasts: Podcast[];
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
  setTags: (tags: Tag[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Map actions
  setMapCenter: (center: [number, number]) => void;
  setMapZoom: (zoom: number) => void;
  setMapBounds: (bounds: MapBounds | null) => void;
  setMapLocked: (locked: boolean) => void;

  // Card actions
  openCard: (podcast: Podcast, fromList?: boolean, notFoundMessage?: string | null) => void;
  closeCard: () => void;
  toggleDescriptionExpanded: () => void;

  // Initial load actions (for URL-based navigation - pan first, then open)
  setPendingInitialPodcast: (podcast: Podcast, notFoundMessage?: string | null) => void;
  clearPendingInitialPodcast: () => void;

  // List view actions
  openListView: () => void;
  closeListView: () => void;
  toggleListView: () => void;
  setTagFilters: (filters: string[]) => void;
  toggleTagFilter: (tagId: string) => void;
  clearTagFilters: () => void;
  saveListScrollPosition: (position: number) => void;
}

export type AppStore = AppState & AppActions;

// Utility type for podcast with coordinates as tuple
export type PodcastCoordinates = Pick<Podcast, 'id' | 'latitude' | 'longitude'>;

// Cluster types for supercluster
export interface ClusterProperties {
  cluster: boolean;
  cluster_id?: number;
  point_count?: number;
  point_count_abbreviated?: string | number;
  podcastId?: string;
}

export interface MapFeature {
  type: 'Feature';
  properties: ClusterProperties;
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
}
