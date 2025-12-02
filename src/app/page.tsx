import Map from './map';

interface Episode {
  id: string;
  fieldData: {
    name: string;
    latitude: number;
    longitude: number;
    'episode-description'?: string;
  };
}

async function getEpisodes(): Promise<Episode[]> {
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000';
  
  try {
    const response = await fetch(`${baseUrl}/map/api/episodes`, {
      cache: 'no-store',
    });
    
    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

export default async function Home() {
  const episodes = await getEpisodes();
  
  return (
    <main>
      <Map episodes={episodes} />
    </main>
  );
}