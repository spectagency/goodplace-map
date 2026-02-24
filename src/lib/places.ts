import type { Place, Tag } from '@/types';
import { parseCoordinates, fetchTagsFromCollection, type WebflowEnv } from './shared';

interface WebflowPlace {
  id: string;
  fieldData: {
    name: string;
    slug?: string;
    'location-coordinates'?: string;
    description?: string;
    'location-name'?: string;
    image?: { url: string };
    'cover-image'?: { url: string };
    'youtube-link'?: { url: string } | string;
    'website-link'?: string;
    'button-text'?: string;
    tags?: string[];
  };
}

// Transform Webflow place to our Place format
function transformPlace(
  item: WebflowPlace,
  tagsMap: Map<string, Tag>
): Place | null {
  // Parse coordinates from Google Maps format
  if (!item.fieldData['location-coordinates']) {
    return null;
  }

  const coords = parseCoordinates(item.fieldData['location-coordinates']);
  if (!coords) {
    return null;
  }

  // Map tag IDs to Tag objects
  const placeTags: Tag[] = (item.fieldData.tags || [])
    .map((tagId: string) => tagsMap.get(tagId))
    .filter((tag): tag is Tag => tag !== undefined);

  // Parse YouTube link (handles both string and object formats)
  const youtubeLink =
    typeof item.fieldData['youtube-link'] === 'object'
      ? item.fieldData['youtube-link']?.url
      : item.fieldData['youtube-link'];

  return {
    id: item.id,
    webflowItemId: item.id,
    type: 'place',
    title: item.fieldData.name,
    slug: item.fieldData.slug || null,
    description: item.fieldData.description || null,
    thumbnailUrl: item.fieldData.image?.url || null,
    mainImageUrl: item.fieldData['cover-image']?.url || null,
    youtubeLink: youtubeLink || null,
    buttonText: item.fieldData['button-text'] || null,
    latitude: coords.latitude,
    longitude: coords.longitude,
    locationName: item.fieldData['location-name'] || null,
    address: null, // Not in current collection
    websiteUrl: item.fieldData['website-link'] || null,
    openingHours: null, // Not in current collection
    createdAt: null,
    updatedAt: null,
    tags: placeTags,
  };
}

export async function getPlaceTagsFromWebflow(env: WebflowEnv): Promise<Tag[]> {
  return fetchTagsFromCollection(
    env.WEBFLOW_SITE_API_TOKEN,
    env.WEBFLOW_PLACE_TAGS_COLLECTION_ID || ''
  );
}

export async function getPlacesFromWebflow(
  env: WebflowEnv,
  tags: Tag[],
  filterTagIds?: string[]
): Promise<Place[]> {
  const collectionId = env.WEBFLOW_PLACES_COLLECTION_ID;
  const token = env.WEBFLOW_SITE_API_TOKEN;

  if (!collectionId || !token) {
    console.error('Missing Webflow places configuration');
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
      console.error('Failed to fetch places from Webflow:', response.statusText);
      throw new Error(`Webflow API error: ${response.statusText}`);
    }

    const data = (await response.json()) as { items: WebflowPlace[] };

    let places = data.items
      .map((item) => transformPlace(item, tagsMap))
      .filter((p): p is Place => p !== null);

    // Apply tag filter if specified
    if (filterTagIds && filterTagIds.length > 0) {
      places = places.filter((place) =>
        place.tags.some((tag) => filterTagIds.includes(tag.id))
      );
    }

    // Sort alphabetically by title
    places.sort((a, b) => a.title.localeCompare(b.title));

    return places;
  } catch (error) {
    console.error('Error fetching places from Webflow:', error);
    throw error;
  }
}

export async function getPlaceBySlug(
  env: WebflowEnv,
  tags: Tag[],
  slug: string
): Promise<Place | null> {
  const places = await getPlacesFromWebflow(env, tags);
  return places.find((p) => p.slug === slug) || null;
}

// Helper function that uses process.env directly (for server components)
export async function getPlaces(tags: Tag[]): Promise<Place[]> {
  const env: WebflowEnv = {
    WEBFLOW_SITE_API_TOKEN: process.env.WEBFLOW_SITE_API_TOKEN || '',
    WEBFLOW_STORIES_COLLECTION_ID: process.env.WEBFLOW_STORIES_COLLECTION_ID || '',
    WEBFLOW_PLACES_COLLECTION_ID: process.env.WEBFLOW_PLACES_COLLECTION_ID,
    WEBFLOW_PLACE_TAGS_COLLECTION_ID: process.env.WEBFLOW_PLACE_TAGS_COLLECTION_ID,
  };
  return getPlacesFromWebflow(env, tags);
}
