import type { Tag } from '@/types';

// Parse coordinates from Google Maps format: "52.09207285741166, 4.277502843983451"
export function parseCoordinates(coordString: string): { latitude: number; longitude: number } | null {
  const parts = coordString.split(',').map((s) => s.trim());
  if (parts.length !== 2) return null;

  const latitude = parseFloat(parts[0]);
  const longitude = parseFloat(parts[1]);

  if (isNaN(latitude) || isNaN(longitude)) return null;
  return { latitude, longitude };
}

// Create a tags map from an array of tags
export function createTagsMap(tags: Tag[]): Map<string, Tag> {
  return new Map(tags.map((tag) => [tag.id, tag]));
}

// Map tag IDs to Tag objects, filtering out unknown tags
export function mapTagIds(tagIds: string[], tagsMap: Map<string, Tag>): Tag[] {
  return tagIds
    .map((tagId) => tagsMap.get(tagId))
    .filter((tag): tag is Tag => tag !== undefined);
}

// Environment interface for Webflow API
export interface WebflowEnv {
  WEBFLOW_SITE_API_TOKEN: string;
  WEBFLOW_COLLECTION_ID: string;
  WEBFLOW_TAGS_COLLECTION_ID?: string;
  // Places collection
  WEBFLOW_PLACES_COLLECTION_ID?: string;
  // Events collection
  WEBFLOW_EVENTS_COLLECTION_ID?: string;
}

// Generic Webflow API fetch function
export async function fetchWebflowCollection<T>(
  collectionId: string,
  token: string
): Promise<T[]> {
  const response = await fetch(
    `https://api.webflow.com/v2/collections/${collectionId}/items`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Webflow API error: ${response.statusText}`);
  }

  const data = (await response.json()) as { items: T[] };
  return data.items;
}
