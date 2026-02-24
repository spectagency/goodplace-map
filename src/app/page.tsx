import { MapContainer } from '@/components/Map';
import { PopupCard } from '@/components/Card';
import { ListViewModal } from '@/components/ListView';
import { StoreInitializer } from '@/components/StoreInitializer';
import { NotFoundToast } from '@/components/UI';
import { getTags, getPodcasts } from '@/lib/podcasts';
import { getPlaceTagsFromWebflow, getPlaces } from '@/lib/places';
import { getInitiativeTagsFromWebflow, getInitiatives } from '@/lib/initiatives';
import type { Tag } from '@/types';
import type { WebflowEnv } from '@/lib/shared';

function getEnv(): WebflowEnv {
  return {
    WEBFLOW_SITE_API_TOKEN: process.env.WEBFLOW_SITE_API_TOKEN || '',
    WEBFLOW_STORIES_COLLECTION_ID: process.env.WEBFLOW_STORIES_COLLECTION_ID || '',
    WEBFLOW_STORY_TAGS_COLLECTION_ID: process.env.WEBFLOW_STORY_TAGS_COLLECTION_ID,
    WEBFLOW_PLACES_COLLECTION_ID: process.env.WEBFLOW_PLACES_COLLECTION_ID,
    WEBFLOW_PLACE_TAGS_COLLECTION_ID: process.env.WEBFLOW_PLACE_TAGS_COLLECTION_ID,
    WEBFLOW_INITIATIVES_COLLECTION_ID: process.env.WEBFLOW_INITIATIVES_COLLECTION_ID,
    WEBFLOW_INITIATIVE_TAGS_COLLECTION_ID: process.env.WEBFLOW_INITIATIVE_TAGS_COLLECTION_ID,
  };
}

export default async function Home() {
  const env = getEnv();

  // Fetch tags per content type in parallel
  const [storyTags, placeTags, initiativeTags] = await Promise.all([
    getTags(),
    getPlaceTagsFromWebflow(env),
    getInitiativeTagsFromWebflow(env),
  ]);

  // Fetch all content types with their own tags
  const [podcasts, places, initiatives] = await Promise.all([
    getPodcasts(storyTags),
    getPlaces(placeTags),
    getInitiatives(initiativeTags),
  ]);

  // Merge all tags for the filter UI, annotated with their content type
  const allTagsMap = new Map<string, Tag>();
  for (const tag of storyTags) allTagsMap.set(tag.id, { ...tag, contentType: 'podcast' });
  for (const tag of placeTags) allTagsMap.set(tag.id, { ...tag, contentType: 'place' });
  for (const tag of initiativeTags) allTagsMap.set(tag.id, { ...tag, contentType: 'initiative' });
  const tags = Array.from(allTagsMap.values()).sort((a, b) => a.name.localeCompare(b.name));

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
