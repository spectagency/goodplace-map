'use client';

import { useEffect, useRef, useMemo, useCallback } from 'react';
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
          pointRadius={10}
          clusterRadius={50}
          clusterMaxZoom={14}
          clusterTextSize={14}
          clusterTextWeight="bold"
          layerIds={CLUSTER_LAYER_IDS}
          onPointClick={handlePointClick}
        />
        <MapControls position="bottom-right" showZoom />
        <FitBoundsOnLoad podcasts={filteredPodcasts} />
        <CleanupMapStyle />
        <HideClusterLayersWhenCardOpen isCardOpen={isCardOpen} />
        <InitialPodcastPanHandler />
        <SelectedPinIndicator />
        <PanToSelectedPin />
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
      maxZoom: 14,
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

    // Get container height to calculate offset
    const container = map.getContainer();
    const containerHeight = container.clientHeight;

    // We want the pin to appear below the card with some margin
    const offsetY = containerHeight * 0.35;

    // Pan to the podcast location first (max zoom for detail)
    map.easeTo({
      center: [pendingPodcast.longitude, pendingPodcast.latitude],
      offset: [0, offsetY],
      zoom: 18,
      duration: 800,
    });

    // After pan completes, open the card
    const handleMoveEnd = () => {
      openCard(pendingPodcast, false, pendingNotFoundMessage);
      clearPendingInitialPodcast();
      map.off('moveend', handleMoveEnd);
    };

    map.once('moveend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [map, isLoaded, pendingPodcast, pendingNotFoundMessage, openCard, clearPendingInitialPodcast]);

  return null;
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

// Component to pan the map so the selected pin appears below the card
function PanToSelectedPin() {
  const { map, isLoaded } = useMap();
  const selectedPodcast = useSelectedPodcast();
  const isCardOpen = useIsCardOpen();
  const prevSelectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!map || !isLoaded || !isCardOpen || !selectedPodcast) return;

    // Only pan if this is a new selection
    if (prevSelectedIdRef.current === selectedPodcast.id) return;
    prevSelectedIdRef.current = selectedPodcast.id;

    // Get container height to calculate offset
    const container = map.getContainer();
    const containerHeight = container.clientHeight;

    // We want the pin to appear below the card with some margin
    // Card is centered at 50%, offset by 35% to give more breathing room
    // Positive Y offset shifts the pin down from center
    const offsetY = containerHeight * 0.35;

    map.easeTo({
      center: [selectedPodcast.longitude, selectedPodcast.latitude],
      offset: [0, offsetY], // Positive Y shifts pin below center
      zoom: 18, // Max zoom for detail when viewing a card
      duration: 500,
    });
  }, [map, isLoaded, isCardOpen, selectedPodcast]);

  // Reset when card closes
  useEffect(() => {
    if (!isCardOpen) {
      prevSelectedIdRef.current = null;
    }
  }, [isCardOpen]);

  return null;
}
