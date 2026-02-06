'use client';

import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import type maplibregl from 'maplibre-gl';
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
  useFilteredMapItems,
  useSelectedItem,
  useIsCardOpen,
  usePendingInitialItem,
  usePendingNotFoundMessage,
} from '@/store/useAppStore';
import type { MapItem, Podcast, Place, Event as GoodEvent } from '@/types';
import { CONTENT_TYPE_CONFIG } from '@/types';
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
  initialPlaces?: Place[];
  initialEvents?: GoodEvent[];
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

export function MapContainer({
  initialPodcasts = [],
  initialPlaces = [],
  initialEvents = [],
}: MapContainerProps) {
  const { setPodcasts, setPlaces, setEvents, openCard } = useAppStore();
  const filteredItems = useFilteredMapItems();
  const isCardOpen = useIsCardOpen();
  const hasInitializedDataRef = useRef(false);

  // Initialize data from server (only once)
  useEffect(() => {
    if (hasInitializedDataRef.current) return;
    hasInitializedDataRef.current = true;

    if (initialPodcasts.length > 0) {
      setPodcasts(initialPodcasts);
    }
    if (initialPlaces.length > 0) {
      setPlaces(initialPlaces);
    }
    if (initialEvents.length > 0) {
      setEvents(initialEvents);
    }
  }, [initialPodcasts, initialPlaces, initialEvents, setPodcasts, setPlaces, setEvents]);

  // Convert all items to GeoJSON FeatureCollection for clustering
  const geoJsonData = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: filteredItems.map((item) => ({
        type: 'Feature' as const,
        properties: {
          id: item.id,
          title: item.title,
          type: item.type,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [item.longitude, item.latitude] as [number, number],
        },
      })),
    };
  }, [filteredItems]);

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
        {/* Custom cluster markers with split colors for mixed content types */}
        <CustomClusterMarkers
          items={filteredItems}
          onClusterClick={handleClusterClick}
        />
        {/* Individual pins for unclustered points */}
        <MapItemPins items={filteredItems} onPinClick={(item) => {
          // Dispatch event to pan first, then open card
          window.dispatchEvent(
            new CustomEvent('pin-click', { detail: { item } })
          );
        }} />
        <HideNativeClusterLayers />
        <AdaptiveClusterZoom />
        <MapControls position="bottom-right" showZoom />
        <FitBoundsOnLoad items={filteredItems} />
        <CleanupMapStyle />
        <HideClusterLayersWhenCardOpen isCardOpen={isCardOpen} />
        <InitialItemPanHandler />
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

// Component to hide native cluster and point layers (we render custom ones)
function HideNativeClusterLayers() {
  const { map, isLoaded } = useMap();
  const hasHiddenRef = useRef(false);

  useEffect(() => {
    if (!map || !isLoaded) return;

    const hideLayers = () => {
      if (hasHiddenRef.current) return;

      // Hide unclustered points
      const pointLayer = map.getLayer(CLUSTER_LAYER_IDS.unclusteredPoint);
      if (pointLayer) {
        map.setPaintProperty(CLUSTER_LAYER_IDS.unclusteredPoint, 'circle-opacity', 0.01);
      }

      // Hide native cluster circles (we'll render custom ones)
      const clusterLayer = map.getLayer(CLUSTER_LAYER_IDS.clusters);
      if (clusterLayer) {
        map.setPaintProperty(CLUSTER_LAYER_IDS.clusters, 'circle-opacity', 0);
      }

      // Hide cluster count text (we'll render it in custom markers)
      const countLayer = map.getLayer(CLUSTER_LAYER_IDS.clusterCount);
      if (countLayer) {
        map.setLayoutProperty(CLUSTER_LAYER_IDS.clusterCount, 'visibility', 'none');
      }

      if (pointLayer && clusterLayer) {
        hasHiddenRef.current = true;
      }
    };

    // Try immediately
    hideLayers();

    // Also try on sourcedata/idle in case layer wasn't ready
    map.on('sourcedata', hideLayers);
    map.on('idle', hideLayers);

    return () => {
      map.off('sourcedata', hideLayers);
      map.off('idle', hideLayers);
    };
  }, [map, isLoaded]);

  return null;
}

// Custom cluster markers with split colors for mixed content types
function CustomClusterMarkers({
  items,
  onClusterClick,
}: {
  items: MapItem[];
  onClusterClick: (clusterId: number, coordinates: [number, number], pointCount: number) => void;
}) {
  const { map, isLoaded } = useMap();
  const [clusters, setClusters] = useState<Array<{
    id: number;
    coordinates: [number, number];
    pointCount: number;
    contentTypes: { podcast: number; place: number; event: number };
  }>>([]);
  const isCardOpen = useIsCardOpen();

  useEffect(() => {
    if (!map || !isLoaded || isCardOpen) {
      setClusters([]);
      return;
    }

    const updateClusters = async () => {
      // Find the cluster source
      const style = map.getStyle();
      const clusterSourceId = style?.sources
        ? Object.keys(style.sources).find(id => id.startsWith('cluster-source-'))
        : null;

      if (!clusterSourceId) return;

      // Query all cluster features
      const clusterFeatures = map.querySourceFeatures(clusterSourceId, {
        sourceLayer: undefined,
        filter: ['has', 'cluster_id'],
      });

      // Deduplicate clusters (querySourceFeatures can return duplicates)
      const seenIds = new Set<number>();
      const uniqueClusters: typeof clusters = [];

      for (const feature of clusterFeatures) {
        const clusterId = feature.properties?.cluster_id;
        if (clusterId === undefined || seenIds.has(clusterId)) continue;
        seenIds.add(clusterId);

        const coords = (feature.geometry as { type: 'Point'; coordinates: [number, number] }).coordinates;
        const pointCount = feature.properties?.point_count || 0;

        // Get cluster children to determine content type mix
        const source = map.getSource(clusterSourceId) as maplibregl.GeoJSONSource | undefined;
        if (!source || !('getClusterLeaves' in source)) continue;

        try {
          const leaves = await source.getClusterLeaves(clusterId, pointCount, 0);

          // Count content types
          const contentTypes = { podcast: 0, place: 0, event: 0 };
          for (const leaf of leaves) {
            const type = leaf.properties?.type as keyof typeof contentTypes;
            if (type in contentTypes) {
              contentTypes[type]++;
            }
          }

          uniqueClusters.push({
            id: clusterId,
            coordinates: coords,
            pointCount,
            contentTypes,
          });
        } catch {
          // Skip if we can't get leaves
        }
      }

      setClusters(uniqueClusters);
    };

    // Update on map movements
    updateClusters();
    map.on('moveend', updateClusters);
    map.on('zoomend', updateClusters);
    map.on('sourcedata', updateClusters);

    return () => {
      map.off('moveend', updateClusters);
      map.off('zoomend', updateClusters);
      map.off('sourcedata', updateClusters);
    };
  }, [map, isLoaded, isCardOpen, items]);

  if (isCardOpen) return null;

  return (
    <>
      {clusters.map((cluster) => (
        <SplitColorCluster
          key={cluster.id}
          coordinates={cluster.coordinates}
          pointCount={cluster.pointCount}
          contentTypes={cluster.contentTypes}
          onClick={() => onClusterClick(cluster.id, cluster.coordinates, cluster.pointCount)}
        />
      ))}
    </>
  );
}

// Split color cluster marker
function SplitColorCluster({
  coordinates,
  pointCount,
  contentTypes,
  onClick,
}: {
  coordinates: [number, number];
  pointCount: number;
  contentTypes: { podcast: number; place: number; event: number };
  onClick: () => void;
}) {
  // Determine cluster size based on point count (larger sizes)
  let size = 36;
  if (pointCount >= 20) size = 56;
  else if (pointCount >= 5) size = 44;

  // Count how many content types are present
  const activeTypes = Object.entries(contentTypes)
    .filter(([_, count]) => count > 0)
    .map(([type]) => type as keyof typeof CONTENT_TYPE_CONFIG);

  // If only one type, show solid color
  if (activeTypes.length === 1) {
    const color = CONTENT_TYPE_CONFIG[activeTypes[0]].pinColor;
    return (
      <MapMarker longitude={coordinates[0]} latitude={coordinates[1]}>
        <MarkerContent>
          <div
            className="flex items-center justify-center rounded-full cursor-pointer shadow-lg font-bold text-white"
            style={{
              width: size,
              height: size,
              backgroundColor: color,
              fontSize: size > 44 ? 16 : 14,
            }}
            onClick={onClick}
          >
            {pointCount}
          </div>
        </MarkerContent>
      </MapMarker>
    );
  }

  // Multiple types - create equal split (50/50 for 2 types, 33/33/33 for 3 types)
  const gradientStops: string[] = [];
  const anglePerType = 360 / activeTypes.length;
  let currentAngle = 0;

  for (const type of (['podcast', 'place', 'event'] as const)) {
    const count = contentTypes[type];
    if (count > 0) {
      const color = CONTENT_TYPE_CONFIG[type].pinColor;
      gradientStops.push(`${color} ${currentAngle}deg ${currentAngle + anglePerType}deg`);
      currentAngle += anglePerType;
    }
  }

  return (
    <MapMarker longitude={coordinates[0]} latitude={coordinates[1]}>
      <MarkerContent>
        <div
          className="flex items-center justify-center rounded-full cursor-pointer shadow-lg font-bold"
          style={{
            width: size,
            height: size,
            background: `conic-gradient(${gradientStops.join(', ')})`,
            fontSize: size > 44 ? 16 : 14,
            color: '#fff',
            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          }}
          onClick={onClick}
        >
          {pointCount}
        </div>
      </MarkerContent>
    </MapMarker>
  );
}

// Component to fit bounds when items load
function FitBoundsOnLoad({ items }: { items: MapItem[] }) {
  const { map, isLoaded } = useMap();
  const pendingItem = usePendingInitialItem();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    // Skip fitBounds if there's a pending initial item (URL-based navigation)
    // In that case, InitialItemPanHandler will handle the map movement
    if (!map || !isLoaded || items.length === 0 || hasFittedRef.current || pendingItem) return;

    // Calculate bounds
    const lngs = items.map((p) => p.longitude);
    const lats = items.map((p) => p.latitude);

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
  }, [map, isLoaded, items, pendingItem]);

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

// Component to handle initial item from URL - pans to location first, then opens card
function InitialItemPanHandler() {
  const { map, isLoaded } = useMap();
  const pendingItem = usePendingInitialItem();
  const pendingNotFoundMessage = usePendingNotFoundMessage();
  const { openCard, clearPendingInitialItem } = useAppStore();
  const hasHandledRef = useRef(false);

  useEffect(() => {
    if (!map || !isLoaded || !pendingItem || hasHandledRef.current) return;
    hasHandledRef.current = true;

    // Calculate offset to position pin just below the centered card
    // Card typically fills to max-height with content (video + text + buttons)
    const pinMargin = 15; // pixels below card
    const offsetY = CARD_MAX_HEIGHT_PX / 2 + pinMargin;

    // Use flyTo for a smooth curved path that zooms and pans together
    const targetZoom = 18;

    map.flyTo({
      center: [pendingItem.longitude, pendingItem.latitude],
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
        openCard(pendingItem, false, pendingNotFoundMessage);
        clearPendingInitialItem();
        map.off('zoom', handleZoom);
        map.off('moveend', handleMoveEnd);
      }
    };

    // Fallback: ensure card opens even if zoom threshold not reached
    const handleMoveEnd = () => {
      if (!hasOpenedCard) {
        hasOpenedCard = true;
        openCard(pendingItem, false, pendingNotFoundMessage);
        clearPendingInitialItem();
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
  }, [map, isLoaded, pendingItem, pendingNotFoundMessage, openCard, clearPendingInitialItem]);

  return null;
}

// Component to render custom styled pins only for unclustered points
function MapItemPins({
  items,
  onPinClick,
}: {
  items: MapItem[];
  onPinClick: (item: MapItem) => void;
}) {
  const { map, isLoaded } = useMap();
  const [unclusteredIds, setUnclusteredIds] = useState<Set<string>>(new Set());
  const selectedItem = useSelectedItem();
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

      // Extract item IDs from rendered features
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
  const unclusteredItems = items.filter(item => unclusteredIds.has(item.id));

  return (
    <>
      {unclusteredItems.map((item) => {
        // Don't render pin for selected item (SelectedPinIndicator handles it)
        if (isCardOpen && selectedItem?.id === item.id) return null;

        return (
          <MapItemPin
            key={item.id}
            item={item}
            onClick={() => onPinClick(item)}
          />
        );
      })}
    </>
  );
}

// Individual map item pin with hover effect and type-based color
function MapItemPin({
  item,
  onClick,
}: {
  item: MapItem;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const pinColor = CONTENT_TYPE_CONFIG[item.type].pinColor;

  return (
    <MapMarker longitude={item.longitude} latitude={item.latitude}>
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
              style={{ backgroundColor: pinColor }}
            />
          )}
          {/* Outer ring - always visible */}
          <div
            className="absolute -inset-2 rounded-full"
            style={{ backgroundColor: pinColor, opacity: 0.3 }}
          />
          {/* Main pin */}
          <div
            className="relative w-5 h-5 rounded-full border-3 border-white shadow-lg"
            style={{ backgroundColor: pinColor }}
          />
        </div>
      </MarkerContent>
    </MapMarker>
  );
}

// Component to show a highlighted marker for the selected pin
function SelectedPinIndicator() {
  const selectedItem = useSelectedItem();
  const isCardOpen = useIsCardOpen();

  if (!isCardOpen || !selectedItem) return null;

  const pinColor = CONTENT_TYPE_CONFIG[selectedItem.type].pinColor;

  return (
    <MapMarker
      longitude={selectedItem.longitude}
      latitude={selectedItem.latitude}
    >
      <MarkerContent>
        <div className="relative">
          {/* Outer pulse ring */}
          <div
            className="absolute -inset-3 rounded-full animate-ping opacity-30"
            style={{ backgroundColor: pinColor }}
          />
          {/* Outer ring */}
          <div
            className="absolute -inset-2 rounded-full"
            style={{ backgroundColor: pinColor, opacity: 0.3 }}
          />
          {/* Main pin */}
          <div
            className="relative w-5 h-5 rounded-full border-3 border-white shadow-lg"
            style={{ backgroundColor: pinColor }}
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
      const { item } = (e as CustomEvent).detail;

      // Calculate offset to position pin just below the centered card
      // Card typically fills to max-height with content (video + text + buttons)
      const pinMargin = 15; // pixels below card
      const offsetY = CARD_MAX_HEIGHT_PX / 2 + pinMargin;
      const targetZoom = 18;

      // Pan to the item location first
      map.flyTo({
        center: [item.longitude, item.latitude],
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
          openCard(item);
          map.off('zoom', handleZoom);
          map.off('moveend', handleMoveEnd);
        }
      };

      // Fallback: ensure card opens even if zoom threshold not reached
      const handleMoveEnd = () => {
        if (!hasOpenedCard) {
          hasOpenedCard = true;
          openCard(item);
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
