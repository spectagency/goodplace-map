import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  getDb,
  podcasts,
  tags,
  podcastTags,
  places,
  placeTags,
  initiatives,
  initiativeTags,
  type DbClient,
} from '@/db';
import { eq } from 'drizzle-orm';

// ============================================
// Webhook payload types
// ============================================

interface WebflowWebhookPayload {
  triggerType: string;
  payload: {
    id: string;
    collectionId: string;
    fieldData: Record<string, unknown>;
  };
}

interface PodcastFieldData {
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

interface PlaceFieldData {
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

interface InitiativeFieldData {
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

interface TagFieldData {
  name: string;
  slug?: string;
}

// ============================================
// Env type
// ============================================

interface WebhookEnv {
  DB: D1Database;
  WEBFLOW_WEBHOOK_SECRET?: string;
  WEBFLOW_STORIES_COLLECTION_ID: string;
  WEBFLOW_PLACES_COLLECTION_ID?: string;
  WEBFLOW_INITIATIVES_COLLECTION_ID?: string;
  WEBFLOW_STORY_TAGS_COLLECTION_ID?: string;
  WEBFLOW_PLACE_TAGS_COLLECTION_ID?: string;
  WEBFLOW_INITIATIVE_TAGS_COLLECTION_ID?: string;
}

// ============================================
// Signature verification
// ============================================

async function verifySignature(
  timestamp: string,
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!timestamp || !signature || !secret) {
    return false;
  }

  // Check if request is older than 5 minutes
  const requestTime = parseInt(timestamp, 10);
  if (Date.now() - requestTime > 300000) {
    return false;
  }

  // HMAC-SHA256 verification using Web Crypto API (available in Cloudflare Workers)
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const data = encoder.encode(`${timestamp}:${body}`);
  const sig = await crypto.subtle.sign('HMAC', key, data);
  const expectedSignature = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison
  if (expectedSignature.length !== signature.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < expectedSignature.length; i++) {
    mismatch |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

// ============================================
// Route handler
// ============================================

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const typedEnv = env as unknown as WebhookEnv;

  // Get headers for signature verification
  const timestamp = request.headers.get('x-webflow-timestamp');
  const signature = request.headers.get('x-webflow-signature');

  if (!timestamp || !signature) {
    return new Response('Missing signature headers', { status: 401 });
  }

  const bodyText = await request.text();

  // Verify signature if secret is configured
  const webhookSecret = typedEnv.WEBFLOW_WEBHOOK_SECRET || '';
  if (webhookSecret) {
    const isValid = await verifySignature(timestamp, bodyText, signature, webhookSecret);
    if (!isValid) {
      return new Response('Invalid signature', { status: 401 });
    }
  }

  const { triggerType, payload } = JSON.parse(bodyText) as WebflowWebhookPayload;
  const db = getDb(env.DB);

  // Build a map of collection IDs to content types
  const collectionMap = new Map<string, string>();
  if (typedEnv.WEBFLOW_STORIES_COLLECTION_ID) {
    collectionMap.set(typedEnv.WEBFLOW_STORIES_COLLECTION_ID, 'podcast');
  }
  if (typedEnv.WEBFLOW_PLACES_COLLECTION_ID) {
    collectionMap.set(typedEnv.WEBFLOW_PLACES_COLLECTION_ID, 'place');
  }
  if (typedEnv.WEBFLOW_INITIATIVES_COLLECTION_ID) {
    collectionMap.set(typedEnv.WEBFLOW_INITIATIVES_COLLECTION_ID, 'initiative');
  }
  if (typedEnv.WEBFLOW_STORY_TAGS_COLLECTION_ID) {
    collectionMap.set(typedEnv.WEBFLOW_STORY_TAGS_COLLECTION_ID, 'tag');
  }
  if (typedEnv.WEBFLOW_PLACE_TAGS_COLLECTION_ID) {
    collectionMap.set(typedEnv.WEBFLOW_PLACE_TAGS_COLLECTION_ID, 'tag');
  }
  if (typedEnv.WEBFLOW_INITIATIVE_TAGS_COLLECTION_ID) {
    collectionMap.set(typedEnv.WEBFLOW_INITIATIVE_TAGS_COLLECTION_ID, 'tag');
  }

  const contentType = collectionMap.get(payload.collectionId);

  if (!contentType) {
    console.log(`Unknown collection ID: ${payload.collectionId}`);
    return new Response('OK', { status: 200 });
  }

  try {
    const isDelete = triggerType === 'collection_item_deleted' || triggerType === 'collection_item_unpublished';

    if (contentType === 'tag') {
      if (isDelete) {
        await deleteTag(db, payload.id);
      } else {
        await upsertTag(db, payload);
      }
    } else if (contentType === 'podcast') {
      if (isDelete) {
        await deletePodcast(db, payload.id);
      } else {
        await upsertPodcast(db, payload);
      }
    } else if (contentType === 'place') {
      if (isDelete) {
        await deletePlace(db, payload.id);
      } else {
        await upsertPlace(db, payload);
      }
    } else if (contentType === 'initiative') {
      if (isDelete) {
        await deleteInitiative(db, payload.id);
      } else {
        await upsertInitiative(db, payload);
      }
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response('Internal error', { status: 500 });
  }
}

// ============================================
// Coordinate + link helpers
// ============================================

function parseCoordinates(fieldData: Record<string, unknown>): { latitude: number; longitude: number } | null {
  // Try combined location-coordinates field first
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
// Tag upsert/delete
// ============================================

async function upsertTag(db: DbClient, payload: WebflowWebhookPayload['payload']) {
  const fieldData = payload.fieldData as unknown as TagFieldData;

  const existing = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.webflowItemId, payload.id))
    .get();

  if (existing) {
    await db
      .update(tags)
      .set({ name: fieldData.name, slug: fieldData.slug })
      .where(eq(tags.webflowItemId, payload.id));
  } else {
    await db.insert(tags).values({
      id: crypto.randomUUID(),
      webflowItemId: payload.id,
      name: fieldData.name,
      slug: fieldData.slug,
    });
  }
}

async function deleteTag(db: DbClient, webflowItemId: string) {
  // Cascade will handle junction table cleanup
  const tag = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.webflowItemId, webflowItemId))
    .get();

  if (tag) {
    await db.delete(tags).where(eq(tags.id, tag.id));
  }
}

// ============================================
// Podcast upsert/delete
// ============================================

async function upsertPodcast(db: DbClient, payload: WebflowWebhookPayload['payload']) {
  const fieldData = payload.fieldData as unknown as PodcastFieldData;

  const coords = parseCoordinates(payload.fieldData);
  if (!coords) {
    console.log('Skipping podcast without valid coordinates:', payload.id);
    return;
  }

  const youtubeLink = parseYoutubeLink(fieldData['youtube-link']);
  const now = new Date().toISOString();

  const existing = await db
    .select({ id: podcasts.id })
    .from(podcasts)
    .where(eq(podcasts.webflowItemId, payload.id))
    .get();

  let podcastId: string;

  if (existing) {
    podcastId = existing.id;
    await db
      .update(podcasts)
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
      .where(eq(podcasts.webflowItemId, payload.id));
  } else {
    podcastId = crypto.randomUUID();
    await db.insert(podcasts).values({
      id: podcastId,
      webflowItemId: payload.id,
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
  await syncPodcastTagJunction(db, podcastId, tagIds);
}

async function deletePodcast(db: DbClient, webflowItemId: string) {
  const existing = await db
    .select({ id: podcasts.id })
    .from(podcasts)
    .where(eq(podcasts.webflowItemId, webflowItemId))
    .get();

  if (existing) {
    await db.delete(podcastTags).where(eq(podcastTags.podcastId, existing.id));
    await db.delete(podcasts).where(eq(podcasts.id, existing.id));
  }
}

async function syncPodcastTagJunction(db: DbClient, podcastId: string, tagWebflowIds: string[]) {
  await db.delete(podcastTags).where(eq(podcastTags.podcastId, podcastId));

  for (const tagWebflowId of tagWebflowIds) {
    const tag = await db
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.webflowItemId, tagWebflowId))
      .get();

    if (tag) {
      await db.insert(podcastTags).values({ podcastId, tagId: tag.id });
    }
  }
}

// ============================================
// Place upsert/delete
// ============================================

async function upsertPlace(db: DbClient, payload: WebflowWebhookPayload['payload']) {
  const fieldData = payload.fieldData as unknown as PlaceFieldData;

  const coords = parseCoordinates(payload.fieldData);
  if (!coords) {
    console.log('Skipping place without valid coordinates:', payload.id);
    return;
  }

  const youtubeLink = parseYoutubeLink(fieldData['youtube-link']);
  const now = new Date().toISOString();

  const existing = await db
    .select({ id: places.id })
    .from(places)
    .where(eq(places.webflowItemId, payload.id))
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
      .where(eq(places.webflowItemId, payload.id));
  } else {
    placeId = crypto.randomUUID();
    await db.insert(places).values({
      id: placeId,
      webflowItemId: payload.id,
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
  await syncPlaceTagJunction(db, placeId, tagIds);
}

async function deletePlace(db: DbClient, webflowItemId: string) {
  const existing = await db
    .select({ id: places.id })
    .from(places)
    .where(eq(places.webflowItemId, webflowItemId))
    .get();

  if (existing) {
    await db.delete(placeTags).where(eq(placeTags.placeId, existing.id));
    await db.delete(places).where(eq(places.id, existing.id));
  }
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
      await db.insert(placeTags).values({ placeId, tagId: tag.id });
    }
  }
}

// ============================================
// Initiative upsert/delete
// ============================================

async function upsertInitiative(db: DbClient, payload: WebflowWebhookPayload['payload']) {
  const fieldData = payload.fieldData as unknown as InitiativeFieldData;

  const coords = parseCoordinates(payload.fieldData);
  if (!coords) {
    console.log('Skipping initiative without valid coordinates:', payload.id);
    return;
  }

  const youtubeLink = parseYoutubeLink(fieldData['video-link']);
  const now = new Date().toISOString();

  const existing = await db
    .select({ id: initiatives.id })
    .from(initiatives)
    .where(eq(initiatives.webflowItemId, payload.id))
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
      .where(eq(initiatives.webflowItemId, payload.id));
  } else {
    initiativeId = crypto.randomUUID();
    await db.insert(initiatives).values({
      id: initiativeId,
      webflowItemId: payload.id,
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
  await syncInitiativeTagJunction(db, initiativeId, tagIds);
}

async function deleteInitiative(db: DbClient, webflowItemId: string) {
  const existing = await db
    .select({ id: initiatives.id })
    .from(initiatives)
    .where(eq(initiatives.webflowItemId, webflowItemId))
    .get();

  if (existing) {
    await db.delete(initiativeTags).where(eq(initiativeTags.initiativeId, existing.id));
    await db.delete(initiatives).where(eq(initiatives.id, existing.id));
  }
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
      await db.insert(initiativeTags).values({ initiativeId, tagId: tag.id });
    }
  }
}
