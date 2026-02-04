import type { Podcast, Tag } from '@/types';

interface WebflowEpisode {
  id: string;
  fieldData: {
    name: string;
    slug?: string;
    'location-coordinates'?: string;
    'latitude-2'?: string;
    'longitude-2'?: string;
    'episode-description'?: string;
    'location-name'?: string;
    'spotify-link'?: string;
    thumbnail?: { url: string };
    'youtube-link'?: { url: string } | string;
    'published-date'?: string;
    'episode-tags'?: string[];
  };
}

interface WebflowTag {
  id: string;
  fieldData: {
    name: string;
    slug?: string;
  };
}

export interface WebflowEnv {
  WEBFLOW_SITE_API_TOKEN: string;
  WEBFLOW_COLLECTION_ID: string;
  WEBFLOW_TAGS_COLLECTION_ID?: string;
}

// Parse coordinates from Google Maps format: "52.09207285741166, 4.277502843983451"
function parseCoordinates(coordString: string): { latitude: number; longitude: number } | null {
  const parts = coordString.split(',').map((s) => s.trim());
  if (parts.length !== 2) return null;

  const latitude = parseFloat(parts[0]);
  const longitude = parseFloat(parts[1]);

  if (isNaN(latitude) || isNaN(longitude)) return null;
  return { latitude, longitude };
}

// Transform Webflow episode to our Podcast format
function transformEpisode(
  episode: WebflowEpisode,
  tagsMap: Map<string, Tag>
): Podcast | null {
  let latitude: number;
  let longitude: number;

  // Try combined coordinates field first (Google Maps format)
  if (episode.fieldData['location-coordinates']) {
    const coords = parseCoordinates(episode.fieldData['location-coordinates']);
    if (coords) {
      latitude = coords.latitude;
      longitude = coords.longitude;
    } else {
      return null;
    }
  } else if (episode.fieldData['latitude-2'] && episode.fieldData['longitude-2']) {
    // Fall back to legacy separate fields
    latitude = parseFloat(episode.fieldData['latitude-2']);
    longitude = parseFloat(episode.fieldData['longitude-2']);
    if (isNaN(latitude) || isNaN(longitude)) {
      return null;
    }
  } else {
    return null;
  }

  const youtubeLink =
    typeof episode.fieldData['youtube-link'] === 'object'
      ? episode.fieldData['youtube-link']?.url
      : episode.fieldData['youtube-link'];

  // Map tag IDs to Tag objects
  const podcastTags: Tag[] = (episode.fieldData['episode-tags'] || [])
    .map((tagId: string) => tagsMap.get(tagId))
    .filter((tag): tag is Tag => tag !== undefined);

  return {
    id: episode.id,
    webflowItemId: episode.id,
    title: episode.fieldData.name,
    slug: episode.fieldData.slug || null,
    description: episode.fieldData['episode-description'] || null,
    thumbnailUrl: episode.fieldData.thumbnail?.url || null,
    youtubeLink: youtubeLink || null,
    spotifyLink: episode.fieldData['spotify-link'] || null,
    latitude,
    longitude,
    locationName: episode.fieldData['location-name'] || null,
    publishedAt: episode.fieldData['published-date'] || null,
    createdAt: null,
    updatedAt: null,
    tags: podcastTags,
  };
}

export async function getTagsFromWebflow(env: WebflowEnv): Promise<Tag[]> {
  const collectionId = env.WEBFLOW_TAGS_COLLECTION_ID;
  const token = env.WEBFLOW_SITE_API_TOKEN;

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

    const data = (await response.json()) as { items: WebflowTag[] };
    return data.items
      .map((item) => ({
        id: item.id,
        name: item.fieldData.name,
        slug: item.fieldData.slug || item.fieldData.name.toLowerCase().replace(/\s+/g, '-'),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching tags from Webflow:', error);
    throw error; // Re-throw to let caller handle
  }
}

// Legacy function for backwards compatibility
export async function getTags(): Promise<Tag[]> {
  const env: WebflowEnv = {
    WEBFLOW_SITE_API_TOKEN: process.env.WEBFLOW_SITE_API_TOKEN || '',
    WEBFLOW_COLLECTION_ID: process.env.WEBFLOW_COLLECTION_ID || '',
    WEBFLOW_TAGS_COLLECTION_ID: process.env.WEBFLOW_TAGS_COLLECTION_ID,
  };
  return getTagsFromWebflow(env);
}

export async function getPodcastsFromWebflow(
  env: WebflowEnv,
  tags: Tag[],
  filterTagIds?: string[]
): Promise<Podcast[]> {
  const collectionId = env.WEBFLOW_COLLECTION_ID;
  const token = env.WEBFLOW_SITE_API_TOKEN;

  if (!collectionId || !token) {
    console.error('Missing Webflow configuration');
    throw new Error('Missing Webflow configuration');
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
      console.error('Failed to fetch from Webflow:', response.statusText);
      throw new Error(`Webflow API error: ${response.statusText}`);
    }

    const data = (await response.json()) as { items: WebflowEpisode[] };

    let podcasts = data.items
      .map((episode) => transformEpisode(episode, tagsMap))
      .filter((p): p is Podcast => p !== null);

    // Apply tag filter if specified
    if (filterTagIds && filterTagIds.length > 0) {
      podcasts = podcasts.filter((podcast) =>
        podcast.tags.some((tag) => filterTagIds.includes(tag.id))
      );
    }

    // Sort by published date (newest first)
    podcasts.sort((a, b) => {
      if (!a.publishedAt && !b.publishedAt) return 0;
      if (!a.publishedAt) return 1;
      if (!b.publishedAt) return -1;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    return podcasts;
  } catch (error) {
    console.error('Error fetching podcasts from Webflow:', error);
    throw error; // Re-throw to let caller handle
  }
}

// Legacy function for backwards compatibility
export async function getPodcasts(tags: Tag[]): Promise<Podcast[]> {
  const env: WebflowEnv = {
    WEBFLOW_SITE_API_TOKEN: process.env.WEBFLOW_SITE_API_TOKEN || '',
    WEBFLOW_COLLECTION_ID: process.env.WEBFLOW_COLLECTION_ID || '',
    WEBFLOW_TAGS_COLLECTION_ID: process.env.WEBFLOW_TAGS_COLLECTION_ID,
  };
  return getPodcastsFromWebflow(env, tags);
}

export async function getPodcastBySlug(slug: string): Promise<{
  podcast: Podcast | null;
  allPodcasts: Podcast[];
  tags: Tag[];
}> {
  const tags = await getTags();
  const podcasts = await getPodcasts(tags);

  const podcast = podcasts.find((p) => p.slug === slug) || null;

  return {
    podcast,
    allPodcasts: podcasts,
    tags,
  };
}

export function getRandomPodcast(podcasts: Podcast[], excludeSlug?: string): Podcast | null {
  const filtered = excludeSlug
    ? podcasts.filter((p) => p.slug !== excludeSlug)
    : podcasts;

  if (filtered.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * filtered.length);
  return filtered[randomIndex];
}
