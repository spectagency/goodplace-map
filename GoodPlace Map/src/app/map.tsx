'use client';
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Episode {
  id: string;
  fieldData: {
    name: string;
    latitude: number;
    longitude: number;
    'episode-description'?: string;
  };
}

interface MapProps {
  episodes: Episode[];
}

export default function Map({ episodes }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
          },
        ],
      },
      center: [5.1214, 52.0907],
      zoom: 7,
    });

    map.current.addControl(new maplibregl.NavigationControl());

    episodes.forEach((episode) => {
      const { latitude, longitude, name } = episode.fieldData;
      const description = episode.fieldData['episode-description'];
      
      if (latitude && longitude) {
        new maplibregl.Marker()
          .setLngLat([longitude, latitude])
          .setPopup(
            new maplibregl.Popup({ offset: 25 }).setHTML(
              `<h3 style="margin: 0 0 8px; font-weight: 600;">${name}</h3>
               <p style="margin: 0;">${description || ''}</p>`
            )
          )
          .addTo(map.current!);
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [episodes]);

  return <div ref={mapContainer} style={{ width: '100%', height: '100vh' }} />;
}