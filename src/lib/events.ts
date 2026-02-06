import type { Event, Tag } from '@/types';
import { parseCoordinates, type WebflowEnv } from './shared';

interface WebflowEvent {
  id: string;
  fieldData: {
    name: string;
    slug?: string;
    'location-coordinates'?: string;
    description?: string;
    'location-name'?: string;
    'video-link'?: { url: string; metadata?: { thumbnail_url?: string } };
    'playlist-link-2'?: string;
    tags?: string[];
  };
}

// Transform Webflow event to our Event format
function transformEvent(
  item: WebflowEvent,
  tagsMap: Map<string, Tag>
): Event | null {
  // Parse coordinates from Google Maps format
  if (!item.fieldData['location-coordinates']) {
    return null;
  }

  const coords = parseCoordinates(item.fieldData['location-coordinates']);
  if (!coords) {
    return null;
  }

  // Map tag IDs to Tag objects
  const eventTags: Tag[] = (item.fieldData.tags || [])
    .map((tagId: string) => tagsMap.get(tagId))
    .filter((tag): tag is Tag => tag !== undefined);

  return {
    id: item.id,
    webflowItemId: item.id,
    type: 'event',
    title: item.fieldData.name,
    slug: item.fieldData.slug || null,
    description: item.fieldData.description || null,
    thumbnailUrl: null, // Events use video embed instead
    latitude: coords.latitude,
    longitude: coords.longitude,
    locationName: item.fieldData['location-name'] || null,
    eventDate: null,
    endDate: null,
    youtubeLink: item.fieldData['video-link']?.url || null,
    playlistLink: item.fieldData['playlist-link-2'] || null,
    createdAt: null,
    updatedAt: null,
    tags: eventTags,
  };
}

export async function getEventsFromWebflow(
  env: WebflowEnv,
  tags: Tag[],
  filterTagIds?: string[]
): Promise<Event[]> {
  const collectionId = env.WEBFLOW_EVENTS_COLLECTION_ID;
  const token = env.WEBFLOW_SITE_API_TOKEN;

  if (!collectionId || !token) {
    console.error('Missing Webflow events configuration');
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
      console.error('Failed to fetch events from Webflow:', response.statusText);
      throw new Error(`Webflow API error: ${response.statusText}`);
    }

    const data = (await response.json()) as { items: WebflowEvent[] };

    let events = data.items
      .map((item) => transformEvent(item, tagsMap))
      .filter((e): e is Event => e !== null);

    // Apply tag filter if specified
    if (filterTagIds && filterTagIds.length > 0) {
      events = events.filter((event) =>
        event.tags.some((tag) => filterTagIds.includes(tag.id))
      );
    }

    // Sort alphabetically by title
    events.sort((a, b) => a.title.localeCompare(b.title));

    return events;
  } catch (error) {
    console.error('Error fetching events from Webflow:', error);
    throw error;
  }
}

export async function getEventBySlug(
  env: WebflowEnv,
  tags: Tag[],
  slug: string
): Promise<Event | null> {
  const events = await getEventsFromWebflow(env, tags);
  return events.find((e) => e.slug === slug) || null;
}

// Helper function that uses process.env directly (for server components)
export async function getEvents(tags: Tag[]): Promise<Event[]> {
  const env: WebflowEnv = {
    WEBFLOW_SITE_API_TOKEN: process.env.WEBFLOW_SITE_API_TOKEN || '',
    WEBFLOW_COLLECTION_ID: process.env.WEBFLOW_COLLECTION_ID || '',
    WEBFLOW_TAGS_COLLECTION_ID: process.env.WEBFLOW_TAGS_COLLECTION_ID,
    WEBFLOW_PLACES_COLLECTION_ID: process.env.WEBFLOW_PLACES_COLLECTION_ID,
    WEBFLOW_EVENTS_COLLECTION_ID: process.env.WEBFLOW_EVENTS_COLLECTION_ID,
  };
  return getEventsFromWebflow(env, tags);
}
