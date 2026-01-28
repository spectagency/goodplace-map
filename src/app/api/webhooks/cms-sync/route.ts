import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb, podcasts, tags, podcastTags } from '@/db';
import { eq } from 'drizzle-orm';

interface WebflowWebhookPayload {
  triggerType: string;
  payload: {
    id: string;
    collectionId: string;
    fieldData: Record<string, unknown>;
  };
}

interface WebflowFieldData {
  name: string;
  slug?: string;
  'episode-description'?: string;
  thumbnail?: { url: string };
  'youtube-link'?: { url: string } | string;
  'spotify-link'?: string;
  'latitude-2'?: string | number;
  'longitude-2'?: string | number;
  'location-name'?: string;
  'published-date'?: string;
  tags?: string[];
}

function verifySignature(
  timestamp: string,
  body: string,
  signature: string,
  secret: string
): boolean {
  // Note: In production, implement proper HMAC verification
  // For now, we'll do a basic check
  if (!timestamp || !signature || !secret) {
    return false;
  }

  // Check if request is older than 5 minutes
  const requestTime = parseInt(timestamp, 10);
  if (Date.now() - requestTime > 300000) {
    return false;
  }

  // TODO: Implement proper HMAC-SHA256 verification
  // This requires the Web Crypto API in Cloudflare Workers
  return true;
}

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });

  // Get headers for signature verification
  const timestamp = request.headers.get('x-webflow-timestamp');
  const signature = request.headers.get('x-webflow-signature');

  if (!timestamp || !signature) {
    return new Response('Missing signature headers', { status: 401 });
  }

  const bodyText = await request.text();

  // Verify signature
  // WEBFLOW_WEBHOOK_SECRET should be set in Webflow Cloud secrets
  const webhookSecret = (env as unknown as Record<string, unknown>).WEBFLOW_WEBHOOK_SECRET as string || '';
  const isValid = verifySignature(
    timestamp,
    bodyText,
    signature,
    webhookSecret
  );

  if (!isValid) {
    return new Response('Invalid signature', { status: 401 });
  }

  const { triggerType, payload } = JSON.parse(bodyText) as WebflowWebhookPayload;
  const db = getDb(env.DB);

  try {
    switch (triggerType) {
      case 'collection_item_created':
      case 'collection_item_changed':
        await upsertPodcast(db, payload);
        break;
      case 'collection_item_deleted':
      case 'collection_item_unpublished':
        await deletePodcast(db, payload.id);
        break;
      default:
        console.log(`Unhandled trigger type: ${triggerType}`);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response('Internal error', { status: 500 });
  }
}

async function upsertPodcast(db: ReturnType<typeof getDb>, payload: WebflowWebhookPayload['payload']) {
  const fieldData = payload.fieldData as unknown as WebflowFieldData;

  // Parse coordinates
  const latitude = typeof fieldData['latitude-2'] === 'string'
    ? parseFloat(fieldData['latitude-2'])
    : fieldData['latitude-2'];
  const longitude = typeof fieldData['longitude-2'] === 'string'
    ? parseFloat(fieldData['longitude-2'])
    : fieldData['longitude-2'];

  if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
    console.log('Skipping podcast without valid coordinates:', payload.id);
    return;
  }

  // Parse YouTube link
  const youtubeLink = typeof fieldData['youtube-link'] === 'object'
    ? fieldData['youtube-link']?.url
    : fieldData['youtube-link'];

  const now = new Date().toISOString();

  // Check if podcast already exists
  const existing = await db
    .select({ id: podcasts.id })
    .from(podcasts)
    .where(eq(podcasts.webflowItemId, payload.id))
    .get();

  if (existing) {
    // Update existing podcast
    await db
      .update(podcasts)
      .set({
        title: fieldData.name,
        slug: fieldData.slug,
        description: fieldData['episode-description'],
        thumbnailUrl: fieldData.thumbnail?.url,
        youtubeLink,
        spotifyLink: fieldData['spotify-link'],
        latitude,
        longitude,
        locationName: fieldData['location-name'],
        publishedAt: fieldData['published-date'],
        updatedAt: now,
      })
      .where(eq(podcasts.webflowItemId, payload.id));

    // Sync tags
    if (fieldData.tags && Array.isArray(fieldData.tags)) {
      await syncPodcastTags(db, existing.id, fieldData.tags);
    }
  } else {
    // Insert new podcast
    const podcastId = crypto.randomUUID();
    await db.insert(podcasts).values({
      id: podcastId,
      webflowItemId: payload.id,
      title: fieldData.name,
      slug: fieldData.slug,
      description: fieldData['episode-description'],
      thumbnailUrl: fieldData.thumbnail?.url,
      youtubeLink,
      spotifyLink: fieldData['spotify-link'],
      latitude,
      longitude,
      locationName: fieldData['location-name'],
      publishedAt: fieldData['published-date'],
      createdAt: now,
      updatedAt: now,
    });

    // Sync tags
    if (fieldData.tags && Array.isArray(fieldData.tags)) {
      await syncPodcastTags(db, podcastId, fieldData.tags);
    }
  }
}

async function deletePodcast(db: ReturnType<typeof getDb>, webflowItemId: string) {
  await db.delete(podcasts).where(eq(podcasts.webflowItemId, webflowItemId));
}

async function syncPodcastTags(
  db: ReturnType<typeof getDb>,
  podcastId: string,
  tagWebflowIds: string[]
) {
  // Delete existing tags for this podcast
  await db.delete(podcastTags).where(eq(podcastTags.podcastId, podcastId));

  // Get tag IDs from webflow IDs
  for (const tagWebflowId of tagWebflowIds) {
    const tag = await db
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.webflowItemId, tagWebflowId))
      .get();

    if (tag) {
      await db.insert(podcastTags).values({
        podcastId,
        tagId: tag.id,
      });
    }
  }
}
