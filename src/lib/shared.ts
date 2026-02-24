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
  WEBFLOW_STORIES_COLLECTION_ID: string;
  WEBFLOW_STORY_TAGS_COLLECTION_ID?: string;
  WEBFLOW_PLACES_COLLECTION_ID?: string;
  WEBFLOW_PLACE_TAGS_COLLECTION_ID?: string;
  WEBFLOW_INITIATIVES_COLLECTION_ID?: string;
  WEBFLOW_INITIATIVE_TAGS_COLLECTION_ID?: string;
}

// Fetch tags from a Webflow collection
export async function fetchTagsFromCollection(
  token: string,
  collectionId: string
): Promise<Tag[]> {
  if (!collectionId || !token) {
    console.error('Missing Webflow tags configuration');
    return [];
  }

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
      console.error('Failed to fetch tags from Webflow:', response.statusText);
      return [];
    }

    const data = (await response.json()) as {
      items: { id: string; fieldData: { name: string; slug?: string } }[];
    };
    return data.items
      .map((item) => ({
        id: item.id,
        name: item.fieldData.name,
        slug: item.fieldData.slug || item.fieldData.name.toLowerCase().replace(/\s+/g, '-'),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching tags from Webflow:', error);
    return [];
  }
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
