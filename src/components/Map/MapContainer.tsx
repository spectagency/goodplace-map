'use client';

import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import {
  Map,
  MapControls,
  MapClusterLayer,
  MapMarker,
  MarkerContent,
  useMap,
} from '@/components/UI/map';
import {
  useAppStore,
  useFilteredPodcasts,
  useSelectedPodcast,
  useIsCardOpen,
  usePendingInitialPodcast,
  usePendingNotFoundMessage,
} from '@/store/useAppStore';
import type { Podcast } from '@/types';
import { ListViewToggle } from './MapControls';
import { CARD_MAX_HEIGHT_PX } from '@/components/Card/PopupCard';

const PRIMARY_GREEN = '#60977F';

// Fixed layer IDs for the cluster layer (allows us to control visibility)
const CLUSTER_LAYER_IDS = {
  clusters: 'clusters',
  clusterCount: 'cluster-count',
  unclusteredPoint: 'unclustered-point',
};

interface MapContainerProps {
  initialPodcasts?: Podcast[];
}

// CARTO basemap styles (uses OpenStreetMap data with cleaner styling)
// Voyager has more color than Positron
const cartoStyles = {
  light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
};

// Layers to hide for a cleaner look
const layersToHide = [
  'place_state',           // Province/state names
  'place_hamlet',          // Small settlements
  'place_suburbs',         // Suburb names
  'watername_sea',         // Sea names (multi-language)
  'watername_ocean',       // Ocean names
  'boundary_state',        // State/province boundaries
  'boundary_county',       // County boundaries
];

export function MapContainer({ initialPodcasts = [] }: MapContainerProps) {
  const { setPodcasts, openCard } = useAppStore();
  const filteredPodcasts = useFilteredPodcasts();
  const isCardOpen = useIsCardOpen();

  // Initialize podcasts from server
  useEffect(() => {
    if (initialPodcasts.length > 0) {
      setPodcasts(initialPodcasts);
    }
  }, [initialPodcasts, setPodcasts]);

  // Convert podcasts to GeoJSON FeatureCollection for clustering
  const geoJsonData = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: filteredPodcasts.map((podcast) => ({
        type: 'Feature' as const,
        properties: {
          id: podcast.id,
          title: podcast.title,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [podcast.longitude, podcast.latitude] as [number, number],
        },
      })),
    };
  }, [filteredPodcasts]);

  // Handle point click - open the card
  const handlePointClick = useCallback(
    (feature: GeoJSON.Feature<GeoJSON.Point>, coordinates: [number, number]) => {
      const podcastId = feature.properties?.id;
      const podcast = filteredPodcasts.find((p) => p.id === podcastId);
      if (podcast) {
        openCard(podcast);
      }
    },
    [filteredPodcasts, openCard]
  );

  // Handle cluster click - adaptive zoom based on cluster size
  const handleClusterClick = useCallback(
    (clusterId: number, coordinates: [number, number], pointCount: number) => {
      // Calculate zoom increment based on cluster size
      // Larger clusters get more aggressive zoom
      let zoomIncrement: number;
      if (pointCount >= 40) {
        zoomIncrement = 5;
      } else if (pointCount >= 25) {
        zoomIncrement = 4;
      } else if (pointCount >= 10) {
        zoomIncrement = 3;
      } else {
        zoomIncrement = 2;
      }

      // This will be handled by AdaptiveClusterZoom component
      // which has access to the map instance
      window.dispatchEvent(
        new CustomEvent('cluster-click', {
          detail: { coordinates, zoomIncrement },
        })
      );
    },
    []
  );

  return (
    <div className="relative w-full h-screen">
      <Map
        center={[5.1214, 52.0907]}
        zoom={7}
        minZoom={1.5}
        maxZoom={18}
        styles={cartoStyles}
        theme="light"
        projection={{ type: 'globe' }}
      >
        <MapClusterLayer
          data={geoJsonData}
          clusterColors={[PRIMARY_GREEN, '#4a7a65', '#3a6050']}
          clusterThresholds={[5, 20]}
          clusterSizes={[28, 36, 48]}
          pointColor={PRIMARY_GREEN}
          pointRadius={6}
          clusterRadius={30}
          clusterMaxZoom={12}
          clusterTextSize={14}
          clusterTextWeight="bold"
          layerIds={CLUSTER_LAYER_IDS}
          onClusterClick={handleClusterClick}
        />
        <PodcastPins podcasts={filteredPodcasts} onPinClick={(podcast) => {
          // Dispatch event to pan first, then open card
          window.dispatchEvent(
            new CustomEvent('pin-click', { detail: { podcast } })
          );
        }} />
        <HideNativeUnclusteredPoints />
        <AdaptiveClusterZoom />
        <MapControls position="bottom-right" showZoom />
        <FitBoundsOnLoad podcasts={filteredPodcasts} />
        <CleanupMapStyle />
        <HideClusterLayersWhenCardOpen isCardOpen={isCardOpen} />
        <InitialPodcastPanHandler />
        <SelectedPinIndicator />
        <PanToSelectedPin />
        <ZoomLevelIndicator />
      </Map>
      <ListViewToggle />
    </div>
  );
}

// Component to hide cluttered layers for a cleaner map
function CleanupMapStyle() {
  const { map, isLoaded } = useMap();
  const hasCleanedRef = useRef(false);

  useEffect(() => {
    if (!map || !isLoaded || hasCleanedRef.current) return;

    // Hide layers that add visual clutter
    for (const layerId of layersToHide) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', 'none');
      }
    }

    hasCleanedRef.current = true;
  }, [map, isLoaded]);

  return null;
}

// Component to make native unclustered points transparent (but still queryable)
function HideNativeUnclusteredPoints() {
  const { map, isLoaded } = useMap();
  const hasHiddenRef = useRef(false);

  useEffect(() => {
    if (!map || !isLoaded) return;

    const hidePoints = () => {
      if (hasHiddenRef.current) return;

      const layer = map.getLayer(CLUSTER_LAYER_IDS.unclusteredPoint);
      if (layer) {
        // Set opacity to near-zero - testing if 0 prevents querying
        map.setPaintProperty(CLUSTER_LAYER_IDS.unclusteredPoint, 'circle-opacity', 0.01);
        hasHiddenRef.current = true;
      }
    };

    // Try immediately
    hidePoints();

    // Also try on sourcedata/idle in case layer wasn't ready
    map.on('sourcedata', hidePoints);
    map.on('idle', hidePoints);

    return () => {
      map.off('sourcedata', hidePoints);
      map.off('idle', hidePoints);
    };
  }, [map, isLoaded]);

  return null;
}

// Component to fit bounds when podcasts load
function FitBoundsOnLoad({ podcasts }: { podcasts: Podcast[] }) {
  const { map, isLoaded } = useMap();
  const pendingPodcast = usePendingInitialPodcast();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    // Skip fitBounds if there's a pending initial podcast (URL-based navigation)
    // In that case, InitialPodcastPanHandler will handle the map movement
    if (!map || !isLoaded || podcasts.length === 0 || hasFittedRef.current || pendingPodcast) return;

    // Calculate bounds
    const lngs = podcasts.map((p) => p.longitude);
    const lats = podcasts.map((p) => p.latitude);

    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];

    map.fitBounds(bounds, {
      padding: 50,
      maxZoom: 11,
      duration: 1000,
    });

    hasFittedRef.current = true;
  }, [map, isLoaded, podcasts, pendingPodcast]);

  return null;
}

// Component to hide cluster layers when card is open
function HideClusterLayersWhenCardOpen({ isCardOpen }: { isCardOpen: boolean }) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;

    // These are the layer IDs created by MapClusterLayer
    const clusterLayerIds = ['clusters', 'cluster-count', 'unclustered-point'];
    const visibility = isCardOpen ? 'none' : 'visible';

    for (const layerId of clusterLayerIds) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visibility);
      }
    }
  }, [map, isLoaded, isCardOpen]);

  return null;
}

// Component to handle initial podcast from URL - pans to location first, then opens card
function InitialPodcastPanHandler() {
  const { map, isLoaded } = useMap();
  const pendingPodcast = usePendingInitialPodcast();
  const pendingNotFoundMessage = usePendingNotFoundMessage();
  const { openCard, clearPendingInitialPodcast } = useAppStore();
  const hasHandledRef = useRef(false);

  useEffect(() => {
    if (!map || !isLoaded || !pendingPodcast || hasHandledRef.current) return;
    hasHandledRef.current = true;

    // Calculate offset to position pin just below the centered card
    // Card typically fills to max-height with content (video + text + buttons)
    const pinMargin = 15; // pixels below card
    const offsetY = CARD_MAX_HEIGHT_PX / 2 + pinMargin;

    // Use flyTo for a smooth curved path that zooms and pans together
    const targetZoom = 18;

    map.flyTo({
      center: [pendingPodcast.longitude, pendingPodcast.latitude],
      offset: [0, offsetY],
      zoom: targetZoom,
      speed: 2.7, // Fast animation
      curve: 1.2, // Less dramatic curve for quicker feel
      easing: (t) => 1 - Math.pow(1 - t, 3), // Ease-out cubic: fast start, smooth arrival
    });

    let hasOpenedCard = false;

    // Open card when we're close to target zoom (overlaps with end of animation)
    const handleZoom = () => {
      if (hasOpenedCard) return;
      const currentZoom = map.getZoom();
      // Open card when within 0.5 zoom levels of target
      if (currentZoom >= targetZoom - 0.5) {
        hasOpenedCard = true;
        openCard(pendingPodcast, false, pendingNotFoundMessage);
        clearPendingInitialPodcast();
        map.off('zoom', handleZoom);
        map.off('moveend', handleMoveEnd);
      }
    };

    // Fallback: ensure card opens even if zoom threshold not reached
    const handleMoveEnd = () => {
      if (!hasOpenedCard) {
        hasOpenedCard = true;
        openCard(pendingPodcast, false, pendingNotFoundMessage);
        clearPendingInitialPodcast();
      }
      map.off('zoom', handleZoom);
      map.off('moveend', handleMoveEnd);
    };

    map.on('zoom', handleZoom);
    map.once('moveend', handleMoveEnd);

    return () => {
      map.off('zoom', handleZoom);
      map.off('moveend', handleMoveEnd);
    };
  }, [map, isLoaded, pendingPodcast, pendingNotFoundMessage, openCard, clearPendingInitialPodcast]);

  return null;
}

// Component to render custom styled pins only for unclustered points
function PodcastPins({
  podcasts,
  onPinClick,
}: {
  podcasts: Podcast[];
  onPinClick: (podcast: Podcast) => void;
}) {
  const { map, isLoaded } = useMap();
  const [unclusteredIds, setUnclusteredIds] = useState<Set<string>>(new Set());
  const selectedPodcast = useSelectedPodcast();
  const isCardOpen = useIsCardOpen();

  useEffect(() => {
    if (!map || !isLoaded) return;

    const updateUnclusteredPins = () => {
      // Check if the unclustered-point layer exists
      const layer = map.getLayer(CLUSTER_LAYER_IDS.unclusteredPoint);
      if (!layer) return;

      // Query rendered features on the unclustered-point layer
      const renderedFeatures = map.queryRenderedFeatures(undefined, {
        layers: [CLUSTER_LAYER_IDS.unclusteredPoint],
      });

      // Extract podcast IDs from rendered features
      const ids = new Set<string>();
      for (const feature of renderedFeatures) {
        const id = feature.properties?.id;
        if (id) {
          ids.add(id);
        }
      }

      // WORKAROUND: At certain zoom levels with globe projection, MapLibre GL
      // doesn't render features even though they exist in the source.
      // Fall back to querying source features directly.
      if (ids.size === 0) {
        const style = map.getStyle();
        const clusterSourceId = style?.sources
          ? Object.keys(style.sources).find(id => id.startsWith('cluster-source-'))
          : null;

        if (clusterSourceId) {
          const sourceFeatures = map.querySourceFeatures(clusterSourceId, {
            sourceLayer: undefined,
          });

          for (const feature of sourceFeatures) {
            // Only include unclustered points (not clusters)
            if (!feature.properties?.cluster) {
              const id = feature.properties?.id;
              if (id) {
                ids.add(id);
              }
            }
          }
        }
      }

      setUnclusteredIds(ids);
    };

    // Update on map movements and zoom changes
    map.on('moveend', updateUnclusteredPins);
    map.on('zoomend', updateUnclusteredPins);
    map.on('sourcedata', updateUnclusteredPins);
    map.on('idle', updateUnclusteredPins);

    // Initial update after a short delay to ensure layers are ready
    const timeoutId = setTimeout(updateUnclusteredPins, 300);

    return () => {
      map.off('moveend', updateUnclusteredPins);
      map.off('zoomend', updateUnclusteredPins);
      map.off('sourcedata', updateUnclusteredPins);
      map.off('idle', updateUnclusteredPins);
      clearTimeout(timeoutId);
    };
  }, [map, isLoaded]);

  // Only render pins for unclustered points
  const unclusteredPodcasts = podcasts.filter(p => unclusteredIds.has(p.id));

  return (
    <>
      {unclusteredPodcasts.map((podcast) => {
        // Don't render pin for selected podcast (SelectedPinIndicator handles it)
        if (isCardOpen && selectedPodcast?.id === podcast.id) return null;

        return (
          <PodcastPin
            key={podcast.id}
            podcast={podcast}
            onClick={() => onPinClick(podcast)}
          />
        );
      })}
    </>
  );
}

// Individual podcast pin with hover effect
function PodcastPin({
  podcast,
  onClick,
}: {
  podcast: Podcast;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <MapMarker longitude={podcast.longitude} latitude={podcast.latitude}>
      <MarkerContent>
        <div
          className="relative cursor-pointer"
          onClick={onClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Outer pulse ring - only on hover */}
          {isHovered && (
            <div
              className="absolute -inset-3 rounded-full animate-ping opacity-30"
              style={{ backgroundColor: PRIMARY_GREEN }}
            />
          )}
          {/* Outer ring - always visible */}
          <div
            className="absolute -inset-2 rounded-full"
            style={{ backgroundColor: PRIMARY_GREEN, opacity: 0.3 }}
          />
          {/* Main pin */}
          <div
            className="relative w-5 h-5 rounded-full border-3 border-white shadow-lg"
            style={{ backgroundColor: PRIMARY_GREEN }}
          />
        </div>
      </MarkerContent>
    </MapMarker>
  );
}

// Component to show a highlighted marker for the selected pin
function SelectedPinIndicator() {
  const selectedPodcast = useSelectedPodcast();
  const isCardOpen = useIsCardOpen();

  if (!isCardOpen || !selectedPodcast) return null;

  return (
    <MapMarker
      longitude={selectedPodcast.longitude}
      latitude={selectedPodcast.latitude}
    >
      <MarkerContent>
        <div className="relative">
          {/* Outer pulse ring */}
          <div
            className="absolute -inset-3 rounded-full animate-ping opacity-30"
            style={{ backgroundColor: PRIMARY_GREEN }}
          />
          {/* Outer ring */}
          <div
            className="absolute -inset-2 rounded-full"
            style={{ backgroundColor: PRIMARY_GREEN, opacity: 0.3 }}
          />
          {/* Main pin */}
          <div
            className="relative w-5 h-5 rounded-full border-3 border-white shadow-lg"
            style={{ backgroundColor: PRIMARY_GREEN }}
          />
        </div>
      </MarkerContent>
    </MapMarker>
  );
}

// Component to handle pin clicks: pan first, then open card
function PanToSelectedPin() {
  const { map, isLoaded } = useMap();
  const { openCard } = useAppStore();

  useEffect(() => {
    if (!map || !isLoaded) return;

    const handlePinClick = (e: Event) => {
      const { podcast } = (e as CustomEvent).detail;

      // Calculate offset to position pin just below the centered card
      // Card typically fills to max-height with content (video + text + buttons)
      const pinMargin = 15; // pixels below card
      const offsetY = CARD_MAX_HEIGHT_PX / 2 + pinMargin;
      const targetZoom = 18;

      // Pan to the podcast location first
      map.flyTo({
        center: [podcast.longitude, podcast.latitude],
        offset: [0, offsetY],
        zoom: targetZoom,
        speed: 2.7, // Fast animation
        curve: 1.2, // Less dramatic curve for quicker feel
        easing: (t) => 1 - Math.pow(1 - t, 3), // Ease-out cubic: fast start, smooth arrival
      });

      let hasOpenedCard = false;

      // Open card when we're close to target zoom (overlaps with end of animation)
      const handleZoom = () => {
        if (hasOpenedCard) return;
        const currentZoom = map.getZoom();
        // Open card when within 0.5 zoom levels of target
        if (currentZoom >= targetZoom - 0.5) {
          hasOpenedCard = true;
          openCard(podcast);
          map.off('zoom', handleZoom);
          map.off('moveend', handleMoveEnd);
        }
      };

      // Fallback: ensure card opens even if zoom threshold not reached
      const handleMoveEnd = () => {
        if (!hasOpenedCard) {
          hasOpenedCard = true;
          openCard(podcast);
        }
        map.off('zoom', handleZoom);
        map.off('moveend', handleMoveEnd);
      };

      map.on('zoom', handleZoom);
      map.once('moveend', handleMoveEnd);
    };

    window.addEventListener('pin-click', handlePinClick);

    return () => {
      window.removeEventListener('pin-click', handlePinClick);
    };
  }, [map, isLoaded, openCard]);

  return null;
}

// Component to handle adaptive cluster zoom
function AdaptiveClusterZoom() {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;

    const handleClusterClick = (e: Event) => {
      const { coordinates, zoomIncrement } = (e as CustomEvent).detail;
      const currentZoom = map.getZoom();
      const targetZoom = Math.min(currentZoom + zoomIncrement, 18);

      map.easeTo({
        center: coordinates,
        zoom: targetZoom,
        duration: 500,
      });
    };

    window.addEventListener('cluster-click', handleClusterClick);

    return () => {
      window.removeEventListener('cluster-click', handleClusterClick);
    };
  }, [map, isLoaded]);

  return null;
}

// Component to display current zoom level
function ZoomLevelIndicator() {
  const { map, isLoaded } = useMap();
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    if (!map || !isLoaded) return;

    // Set initial zoom
    setZoom(Math.round(map.getZoom() * 10) / 10);

    // Update zoom on change
    const handleZoom = () => {
      setZoom(Math.round(map.getZoom() * 10) / 10);
    };

    map.on('zoom', handleZoom);

    return () => {
      map.off('zoom', handleZoom);
    };
  }, [map, isLoaded]);

  if (zoom === null) return null;

  return (
    <div className="absolute bottom-4 right-20 bg-white/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-mono text-gray-600 shadow-sm">
      z{zoom}
    </div>
  );
}
