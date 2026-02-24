import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  getDb,
  stories,
  tags,
  storyTags,
  places,
  placeTags,
  initiatives,
  initiativeTags,
  type DbClient,
} from '@/db';
import { eq } from 'drizzle-orm';

interface WebflowItem {
  id: string;
  fieldData: Record<string, unknown>;
}

interface WebflowListResponse {
  items: WebflowItem[];
  pagination?: {
    limit: number;
    offset: number;
    total: number;
  };
}

// ============================================
// Webflow field data interfaces per content type
// ============================================

interface WebflowTagFieldData {
  name: string;
  slug?: string;
}

interface WebflowPodcastFieldData {
  name: string;
  slug?: string;
  'episode-description'?: string;
  'cover-image'?: { url: string };
  'main-image'?: { url: string };
  'youtube-link'?: { url: string } | string;
  'spotify-link'?: string;
  'button-text'?: string;
  'latitude-2'?: string | number;
  'longitude-2'?: string | number;
  'location-coordinates'?: string;
  'location-name'?: string;
  'published-date'?: string;
  'episode-tags'?: string[];
}

interface WebflowPlaceFieldData {
  name: string;
  slug?: string;
  description?: string;
  image?: { url: string };
  'cover-image'?: { url: string };
  'youtube-link'?: { url: string } | string;
  'website-link'?: string;
  'button-text'?: string;
  'location-coordinates'?: string;
  'location-name'?: string;
  tags?: string[];
}

interface WebflowInitiativeFieldData {
  name: string;
  slug?: string;
  description?: string;
  'thumbnail-image-2'?: { url: string };
  'cover-image-2'?: { url: string };
  'video-link'?: { url: string };
  'playlist-link-2'?: string;
  'button-text-2'?: string;
  'location-coordinates'?: string;
  'location-name'?: string;
  'initiative-tags-2'?: string[];
}

// ============================================
// Env type
// ============================================

interface SyncEnv {
  DB: D1Database;
  WEBFLOW_SITE_API_TOKEN: string;
  WEBFLOW_STORIES_COLLECTION_ID: string;
  WEBFLOW_STORY_TAGS_COLLECTION_ID?: string;
  WEBFLOW_PLACES_COLLECTION_ID?: string;
  WEBFLOW_PLACE_TAGS_COLLECTION_ID?: string;
  WEBFLOW_INITIATIVES_COLLECTION_ID?: string;
  WEBFLOW_INITIATIVE_TAGS_COLLECTION_ID?: string;
}

// ============================================
// Route handler
// ============================================

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const typedEnv = env as unknown as SyncEnv;

  // Check for authorization
  const authHeader = request.headers.get('authorization');
  const expectedToken = typedEnv.WEBFLOW_SITE_API_TOKEN;

  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb(env.DB);

  try {
    const results: Record<string, number> = {};

    // Sync all tag collections first (content items reference tags)
    if (typedEnv.WEBFLOW_STORY_TAGS_COLLECTION_ID) {
      results.storyTags = await syncTagsFromCollection(db, typedEnv.WEBFLOW_STORY_TAGS_COLLECTION_ID, expectedToken);
    }
    if (typedEnv.WEBFLOW_PLACE_TAGS_COLLECTION_ID) {
      results.placeTags = await syncTagsFromCollection(db, typedEnv.WEBFLOW_PLACE_TAGS_COLLECTION_ID, expectedToken);
    }
    if (typedEnv.WEBFLOW_INITIATIVE_TAGS_COLLECTION_ID) {
      results.initiativeTags = await syncTagsFromCollection(db, typedEnv.WEBFLOW_INITIATIVE_TAGS_COLLECTION_ID, expectedToken);
    }

    // Sync all content types
    if (typedEnv.WEBFLOW_STORIES_COLLECTION_ID) {
      results.stories = await syncStories(db, typedEnv.WEBFLOW_STORIES_COLLECTION_ID, expectedToken);
    }
    if (typedEnv.WEBFLOW_PLACES_COLLECTION_ID) {
      results.places = await syncPlaces(db, typedEnv.WEBFLOW_PLACES_COLLECTION_ID, expectedToken);
    }
    if (typedEnv.WEBFLOW_INITIATIVES_COLLECTION_ID) {
      results.initiatives = await syncInitiatives(db, typedEnv.WEBFLOW_INITIATIVES_COLLECTION_ID, expectedToken);
    }

    return Response.json({
      success: true,
      message: 'Sync complete',
      results,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return Response.json(
      { error: 'Sync failed', details: String(error) },
      { status: 500 }
    );
  }
}

// ============================================
// Helpers
// ============================================

async function fetchWebflowItems(collectionId: string, token: string): Promise<WebflowItem[]> {
  const allItems: WebflowItem[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await fetch(
      `https://api.webflow.com/v2/collections/${collectionId}/items?limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      throw new Error(`Webflow API error for collection ${collectionId}: ${response.statusText}`);
    }

    const data = (await response.json()) as WebflowListResponse;
    allItems.push(...(data.items || []));

    // Check if there are more pages
    if (!data.pagination || allItems.length >= data.pagination.total) {
      break;
    }
    offset += limit;
  }

  return allItems;
}

function parseCoordinates(fieldData: Record<string, unknown>): { latitude: number; longitude: number } | null {
  // Try combined location-coordinates field first (format: "lat, lng")
  const coordString = fieldData['location-coordinates'] as string | undefined;
  if (coordString) {
    const parts = coordString.split(',').map((s) => s.trim());
    if (parts.length === 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { latitude: lat, longitude: lng };
      }
    }
  }

  // Fall back to separate latitude-2/longitude-2 fields
  const lat2 = fieldData['latitude-2'];
  const lng2 = fieldData['longitude-2'];
  if (lat2 !== undefined && lng2 !== undefined) {
    const lat = typeof lat2 === 'string' ? parseFloat(lat2) : (lat2 as number);
    const lng = typeof lng2 === 'string' ? parseFloat(lng2) : (lng2 as number);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { latitude: lat, longitude: lng };
    }
  }

  return null;
}

function parseYoutubeLink(value: unknown): string | undefined {
  if (typeof value === 'object' && value !== null && 'url' in value) {
    return (value as { url: string }).url;
  }
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

// ============================================
// Tags sync (shared across content types)
// ============================================

async function syncTagsFromCollection(
  db: DbClient,
  collectionId: string,
  token: string
): Promise<number> {
  const items = await fetchWebflowItems(collectionId, token);
  let count = 0;

  for (const item of items) {
    const fieldData = item.fieldData as unknown as WebflowTagFieldData;

    const existing = await db
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.webflowItemId, item.id))
      .get();

    if (existing) {
      await db
        .update(tags)
        .set({
          name: fieldData.name,
          slug: fieldData.slug,
        })
        .where(eq(tags.webflowItemId, item.id));
    } else {
      await db.insert(tags).values({
        id: crypto.randomUUID(),
        webflowItemId: item.id,
        name: fieldData.name,
        slug: fieldData.slug,
      });
    }
    count++;
  }

  return count;
}

// ============================================
// Stories sync
// ============================================

async function syncStories(
  db: DbClient,
  collectionId: string,
  token: string
): Promise<number> {
  const items = await fetchWebflowItems(collectionId, token);
  const now = new Date().toISOString();
  let count = 0;

  for (const item of items) {
    const fieldData = item.fieldData as unknown as WebflowPodcastFieldData;

    const coords = parseCoordinates(item.fieldData);
    if (!coords) {
      console.log('Skipping story without valid coordinates:', item.id);
      continue;
    }

    const youtubeLink = parseYoutubeLink(fieldData['youtube-link']);

    const existing = await db
      .select({ id: stories.id })
      .from(stories)
      .where(eq(stories.webflowItemId, item.id))
      .get();

    let storyId: string;

    if (existing) {
      storyId = existing.id;
      await db
        .update(stories)
        .set({
          title: fieldData.name,
          slug: fieldData.slug,
          description: fieldData['episode-description'],
          thumbnailUrl: fieldData['cover-image']?.url,
          mainImageUrl: fieldData['main-image']?.url,
          youtubeLink,
          buttonText: fieldData['button-text'],
          spotifyLink: fieldData['spotify-link'],
          latitude: coords.latitude,
          longitude: coords.longitude,
          locationName: fieldData['location-name'],
          publishedAt: fieldData['published-date'],
          updatedAt: now,
        })
        .where(eq(stories.webflowItemId, item.id));
    } else {
      storyId = crypto.randomUUID();
      await db.insert(stories).values({
        id: storyId,
        webflowItemId: item.id,
        title: fieldData.name,
        slug: fieldData.slug,
        description: fieldData['episode-description'],
        thumbnailUrl: fieldData['cover-image']?.url,
        mainImageUrl: fieldData['main-image']?.url,
        youtubeLink,
        buttonText: fieldData['button-text'],
        spotifyLink: fieldData['spotify-link'],
        latitude: coords.latitude,
        longitude: coords.longitude,
        locationName: fieldData['location-name'],
        publishedAt: fieldData['published-date'],
        createdAt: now,
        updatedAt: now,
      });
    }

    // Sync tags
    const tagIds = fieldData['episode-tags'] || [];
    if (tagIds.length > 0) {
      await syncStoryTagJunction(db, storyId, tagIds);
    }

    count++;
  }

  return count;
}

async function syncStoryTagJunction(db: DbClient, storyId: string, tagWebflowIds: string[]) {
  await db.delete(storyTags).where(eq(storyTags.storyId, storyId));

  for (const tagWebflowId of tagWebflowIds) {
    const tag = await db
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.webflowItemId, tagWebflowId))
      .get();

    if (tag) {
      await db.insert(storyTags).values({
        storyId,
        tagId: tag.id,
      });
    }
  }
}

// ============================================
// Places sync
// ============================================

async function syncPlaces(
  db: DbClient,
  collectionId: string,
  token: string
): Promise<number> {
  const items = await fetchWebflowItems(collectionId, token);
  const now = new Date().toISOString();
  let count = 0;

  for (const item of items) {
    const fieldData = item.fieldData as unknown as WebflowPlaceFieldData;

    const coords = parseCoordinates(item.fieldData);
    if (!coords) {
      console.log('Skipping place without valid coordinates:', item.id);
      continue;
    }

    const youtubeLink = parseYoutubeLink(fieldData['youtube-link']);

    const existing = await db
      .select({ id: places.id })
      .from(places)
      .where(eq(places.webflowItemId, item.id))
      .get();

    let placeId: string;

    if (existing) {
      placeId = existing.id;
      await db
        .update(places)
        .set({
          title: fieldData.name,
          slug: fieldData.slug,
          description: fieldData.description,
          thumbnailUrl: fieldData.image?.url,
          mainImageUrl: fieldData['cover-image']?.url,
          youtubeLink,
          buttonText: fieldData['button-text'],
          latitude: coords.latitude,
          longitude: coords.longitude,
          locationName: fieldData['location-name'],
          websiteUrl: fieldData['website-link'],
          updatedAt: now,
        })
        .where(eq(places.webflowItemId, item.id));
    } else {
      placeId = crypto.randomUUID();
      await db.insert(places).values({
        id: placeId,
        webflowItemId: item.id,
        title: fieldData.name,
        slug: fieldData.slug,
        description: fieldData.description,
        thumbnailUrl: fieldData.image?.url,
        mainImageUrl: fieldData['cover-image']?.url,
        youtubeLink,
        buttonText: fieldData['button-text'],
        latitude: coords.latitude,
        longitude: coords.longitude,
        locationName: fieldData['location-name'],
        websiteUrl: fieldData['website-link'],
        createdAt: now,
        updatedAt: now,
      });
    }

    // Sync tags
    const tagIds = fieldData.tags || [];
    if (tagIds.length > 0) {
      await syncPlaceTagJunction(db, placeId, tagIds);
    }

    count++;
  }

  return count;
}

async function syncPlaceTagJunction(db: DbClient, placeId: string, tagWebflowIds: string[]) {
  await db.delete(placeTags).where(eq(placeTags.placeId, placeId));

  for (const tagWebflowId of tagWebflowIds) {
    const tag = await db
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.webflowItemId, tagWebflowId))
      .get();

    if (tag) {
      await db.insert(placeTags).values({
        placeId,
        tagId: tag.id,
      });
    }
  }
}

// ============================================
// Initiatives sync
// ============================================

async function syncInitiatives(
  db: DbClient,
  collectionId: string,
  token: string
): Promise<number> {
  const items = await fetchWebflowItems(collectionId, token);
  const now = new Date().toISOString();
  let count = 0;

  for (const item of items) {
    const fieldData = item.fieldData as unknown as WebflowInitiativeFieldData;

    const coords = parseCoordinates(item.fieldData);
    if (!coords) {
      console.log('Skipping initiative without valid coordinates:', item.id);
      continue;
    }

    const youtubeLink = parseYoutubeLink(fieldData['video-link']);

    const existing = await db
      .select({ id: initiatives.id })
      .from(initiatives)
      .where(eq(initiatives.webflowItemId, item.id))
      .get();

    let initiativeId: string;

    if (existing) {
      initiativeId = existing.id;
      await db
        .update(initiatives)
        .set({
          title: fieldData.name,
          slug: fieldData.slug,
          description: fieldData.description,
          thumbnailUrl: fieldData['thumbnail-image-2']?.url,
          mainImageUrl: fieldData['cover-image-2']?.url,
          youtubeLink,
          buttonText: fieldData['button-text-2'],
          latitude: coords.latitude,
          longitude: coords.longitude,
          locationName: fieldData['location-name'],
          googlePlaylistUrl: fieldData['playlist-link-2'],
          updatedAt: now,
        })
        .where(eq(initiatives.webflowItemId, item.id));
    } else {
      initiativeId = crypto.randomUUID();
      await db.insert(initiatives).values({
        id: initiativeId,
        webflowItemId: item.id,
        title: fieldData.name,
        slug: fieldData.slug,
        description: fieldData.description,
        thumbnailUrl: fieldData['thumbnail-image-2']?.url,
        mainImageUrl: fieldData['cover-image-2']?.url,
        youtubeLink,
        buttonText: fieldData['button-text-2'],
        latitude: coords.latitude,
        longitude: coords.longitude,
        locationName: fieldData['location-name'],
        googlePlaylistUrl: fieldData['playlist-link-2'],
        createdAt: now,
        updatedAt: now,
      });
    }

    // Sync tags
    const tagIds = fieldData['initiative-tags-2'] || [];
    if (tagIds.length > 0) {
      await syncInitiativeTagJunction(db, initiativeId, tagIds);
    }

    count++;
  }

  return count;
}

async function syncInitiativeTagJunction(db: DbClient, initiativeId: string, tagWebflowIds: string[]) {
  await db.delete(initiativeTags).where(eq(initiativeTags.initiativeId, initiativeId));

  for (const tagWebflowId of tagWebflowIds) {
    const tag = await db
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.webflowItemId, tagWebflowId))
      .get();

    if (tag) {
      await db.insert(initiativeTags).values({
        initiativeId,
        tagId: tag.id,
      });
    }
  }
}
