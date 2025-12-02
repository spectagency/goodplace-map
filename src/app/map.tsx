'use client';
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Episode } from './types';

interface MapProps {
  episodes: Episode[];
}

function getYouTubeEmbedUrl(url: string): string {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
  if (match) {
    return `https://www.youtube.com/embed/${match[1]}`;
  }
  return url;
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
      const { name } = episode.fieldData;
      const latitude = parseFloat(episode.fieldData['latitude-2']);
      const longitude = parseFloat(episode.fieldData['longitude-2']);

      console.log('Parsed lat:', latitude, 'Parsed lng:', longitude);

      const description = episode.fieldData['episode-description'];
      const locationName = episode.fieldData['location-name'];
      const spotifyLink = episode.fieldData['spotify-link'];
      const youtubeLink = episode.fieldData['youtube-link'];

      if (latitude && longitude && !isNaN(latitude) && !isNaN(longitude)) {
        const marker = new maplibregl.Marker({ color: '#1DB954' })
          .setLngLat([longitude, latitude]);

        const youtubeEmbed = youtubeLink?.url
          ? `<div style="margin: 12px 0; border-radius: 8px; overflow: hidden;">
               <iframe 
                 width="100%" 
                 height="180" 
                 src="${getYouTubeEmbedUrl(youtubeLink.url)}" 
                 frameborder="0" 
                 allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                 allowfullscreen
                 style="display: block;"
               ></iframe>
             </div>`
          : '';

        const spotifyButton = spotifyLink
          ? `<a href="${spotifyLink}" target="_blank" rel="noopener noreferrer" style="
               display: inline-flex;
               align-items: center;
               gap: 8px;
               background: #1DB954;
               color: white;
               padding: 10px 16px;
               border-radius: 24px;
               text-decoration: none;
               font-weight: 600;
               font-size: 14px;
               margin-top: 12px;
             ">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                 <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
               </svg>
               Listen on Spotify
             </a>`
          : '';

        const popupContent = `
          <div style="
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            width: 320px;
            max-width: 90vw;
          ">
            ${locationName ? `<p style="margin: 0 0 4px; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">${locationName}</p>` : ''}
            <h3 style="margin: 0 0 8px; font-size: 18px; font-weight: 700; color: #111;">${name}</h3>
            ${youtubeEmbed}
            ${description ? `<p style="margin: 0; font-size: 14px; line-height: 1.5; color: #444;">${description}</p>` : ''}
            ${spotifyButton}
          </div>
        `;

        const popup = new maplibregl.Popup({
          offset: 25,
          maxWidth: '360px',
          closeButton: true,
          closeOnClick: false,
        }).setHTML(popupContent);

        marker.setPopup(popup);

        marker.getElement().addEventListener('click', () => {
          map.current?.flyTo({
            center: [longitude, latitude],
            zoom: 10,
            duration: 1000,
          });
        });

        marker.addTo(map.current!);
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [episodes]);

  return <div ref={mapContainer} style={{ width: '100%', height: '100vh' }} />;
}