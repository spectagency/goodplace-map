import type { Initiative, Tag } from '@/types';
import { parseCoordinates, fetchTagsFromCollection, type WebflowEnv } from './shared';

interface WebflowInitiative {
  id: string;
  fieldData: {
    name: string;
    slug?: string;
    'location-coordinates'?: string;
    description?: string;
    'location-name'?: string;
    'thumbnail-image-2'?: { url: string };
    'cover-image-2'?: { url: string };
    'video-link'?: { url: string; metadata?: { thumbnail_url?: string } };
    'playlist-link-2'?: string;
    'button-text-2'?: string;
    'initiative-tags-2'?: string[];
  };
}

// Transform Webflow initiative to our Initiative format
function transformInitiative(
  item: WebflowInitiative,
  tagsMap: Map<string, Tag>
): Initiative | null {
  // Parse coordinates from Google Maps format
  if (!item.fieldData['location-coordinates']) {
    return null;
  }

  const coords = parseCoordinates(item.fieldData['location-coordinates']);
  if (!coords) {
    return null;
  }

  // Map tag IDs to Tag objects
  const initiativeTags: Tag[] = (item.fieldData['initiative-tags-2'] || [])
    .map((tagId: string) => tagsMap.get(tagId))
    .filter((tag): tag is Tag => tag !== undefined);

  return {
    id: item.id,
    webflowItemId: item.id,
    type: 'initiative',
    title: item.fieldData.name,
    slug: item.fieldData.slug || null,
    description: item.fieldData.description || null,
    thumbnailUrl: item.fieldData['thumbnail-image-2']?.url || null,
    mainImageUrl: item.fieldData['cover-image-2']?.url || null,
    youtubeLink: item.fieldData['video-link']?.url || null,
    buttonText: item.fieldData['button-text-2'] || null,
    latitude: coords.latitude,
    longitude: coords.longitude,
    locationName: item.fieldData['location-name'] || null,
    eventDate: null,
    endDate: null,
    playlistLink: item.fieldData['playlist-link-2'] || null,
    createdAt: null,
    updatedAt: null,
    tags: initiativeTags,
  };
}

export async function getInitiativeTagsFromWebflow(env: WebflowEnv): Promise<Tag[]> {
  return fetchTagsFromCollection(
    env.WEBFLOW_SITE_API_TOKEN,
    env.WEBFLOW_INITIATIVE_TAGS_COLLECTION_ID || ''
  );
}

export async function getInitiativesFromWebflow(
  env: WebflowEnv,
  tags: Tag[],
  filterTagIds?: string[]
): Promise<Initiative[]> {
  const collectionId = env.WEBFLOW_INITIATIVES_COLLECTION_ID;
  const token = env.WEBFLOW_SITE_API_TOKEN;

  if (!collectionId || !token) {
    console.error('Missing Webflow initiatives configuration');
    return [];
  }

  // Create a map of tag IDs to Tag objects for quick lookup
  const tagsMap = new Map<string, Tag>(tags.map((tag) => [tag.id, tag]));

  try {
    const response = await fetch(
      `https://api.webflow.com/v2/collections/${collectionId}/items`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch initiatives from Webflow:', response.statusText);
      throw new Error(`Webflow API error: ${response.statusText}`);
    }

    const data = (await response.json()) as { items: WebflowInitiative[] };

    let initiatives = data.items
      .map((item) => transformInitiative(item, tagsMap))
      .filter((e): e is Initiative => e !== null);

    // Apply tag filter if specified
    if (filterTagIds && filterTagIds.length > 0) {
      initiatives = initiatives.filter((initiative) =>
        initiative.tags.some((tag) => filterTagIds.includes(tag.id))
      );
    }

    // Sort alphabetically by title
    initiatives.sort((a, b) => a.title.localeCompare(b.title));

    return initiatives;
  } catch (error) {
    console.error('Error fetching initiatives from Webflow:', error);
    throw error;
  }
}

export async function getInitiativeBySlug(
  env: WebflowEnv,
  tags: Tag[],
  slug: string
): Promise<Initiative | null> {
  const initiatives = await getInitiativesFromWebflow(env, tags);
  return initiatives.find((i) => i.slug === slug) || null;
}

// Helper function that uses process.env directly (for server components)
export async function getInitiatives(tags: Tag[]): Promise<Initiative[]> {
  const env: WebflowEnv = {
    WEBFLOW_SITE_API_TOKEN: process.env.WEBFLOW_SITE_API_TOKEN || '',
    WEBFLOW_STORIES_COLLECTION_ID: process.env.WEBFLOW_STORIES_COLLECTION_ID || '',
    WEBFLOW_INITIATIVES_COLLECTION_ID: process.env.WEBFLOW_INITIATIVES_COLLECTION_ID,
    WEBFLOW_INITIATIVE_TAGS_COLLECTION_ID: process.env.WEBFLOW_INITIATIVE_TAGS_COLLECTION_ID,
  };
  return getInitiativesFromWebflow(env, tags);
}
