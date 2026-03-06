import { MapContainer } from '@/components/Map';
import { PopupCard } from '@/components/Card';
import { ListViewModal } from '@/components/ListView';
import { StoreInitializer } from '@/components/StoreInitializer';
import { NotFoundToast } from '@/components/UI';
import { getAllTags, getAllStories, getAllPlaces, getAllInitiatives } from '@/lib/data';
import type { WebflowEnv } from '@/lib/shared';

function getEnv(): WebflowEnv {
  return {
    WEBFLOW_SITE_API_TOKEN: process.env.WEBFLOW_SITE_API_TOKEN || '',
    WEBFLOW_STORIES_COLLECTION_ID: process.env.WEBFLOW_STORIES_COLLECTION_ID || '',
    WEBFLOW_TAGS_COLLECTION_ID: process.env.WEBFLOW_TAGS_COLLECTION_ID,
    WEBFLOW_PLACES_COLLECTION_ID: process.env.WEBFLOW_PLACES_COLLECTION_ID,
    WEBFLOW_INITIATIVES_COLLECTION_ID: process.env.WEBFLOW_INITIATIVES_COLLECTION_ID,
  };
}

export default async function Home() {
  const env = getEnv();

  // Fetch tags (DB first, Webflow API fallback)
  const tags = await getAllTags(env);

  // Fetch all content types (DB first, Webflow API fallback)
  const [podcasts, places, initiatives] = await Promise.all([
    getAllStories(env, tags),
    getAllPlaces(env, tags),
    getAllInitiatives(env, tags),
  ]);

  return (
    <main className="relative w-full h-screen overflow-hidden">
      <StoreInitializer tags={tags} />
      <MapContainer initialPodcasts={podcasts} initialPlaces={places} initialInitiatives={initiatives} />
      <PopupCard />
      <ListViewModal />
      <NotFoundToast />
    </main>
  );
}
