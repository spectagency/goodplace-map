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
  const collectionId = process.env.WEBFLOW_COLLECTION_ID;
  const token = process.env.WEBFLOW_SITE_API_TOKEN;

  try {
    const response = await fetch(
      `https://api.webflow.com/v2/collections/${collectionId}/items`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) return [];

    const data = (await response.json()) as { items: Episode[] };
    return data.items;
  } catch (error) {
    console.error('Error fetching episodes:', error);
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