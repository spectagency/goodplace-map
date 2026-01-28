import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb, podcasts, tags, podcastTags } from '@/db';
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

interface WebflowPodcastFieldData {
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

interface WebflowTagFieldData {
  name: string;
  slug?: string;
}

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });

  // Cast env to include our custom variables
  const typedEnv = env as typeof env & {
    WEBFLOW_SITE_API_TOKEN: string;
    WEBFLOW_COLLECTION_ID: string;
    WEBFLOW_TAGS_COLLECTION_ID?: string;
  };

  // Check for authorization (simple bearer token check)
  const authHeader = request.headers.get('authorization');
  const expectedToken = typedEnv.WEBFLOW_SITE_API_TOKEN;

  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb(env.DB);

  try {
    // Fetch and sync tags first (podcasts reference tags)
    const tagsCollectionId = typedEnv.WEBFLOW_TAGS_COLLECTION_ID;
    if (tagsCollectionId) {
      await syncTags(db, tagsCollectionId, expectedToken);
    }

    // Fetch and sync podcasts
    const podcastsCollectionId = typedEnv.WEBFLOW_COLLECTION_ID;
    if (podcastsCollectionId) {
      const count = await syncPodcasts(db, podcastsCollectionId, expectedToken);
      return Response.json({
        success: true,
        message: `Synced ${count} podcasts`,
      });
    }

    return Response.json({ error: 'Missing collection ID' }, { status: 400 });
  } catch (error) {
    console.error('Sync error:', error);
    return Response.json(
      { error: 'Sync failed', details: String(error) },
      { status: 500 }
    );
  }
}

async function syncTags(
  db: ReturnType<typeof getDb>,
  collectionId: string,
  token: string
): Promise<number> {
  const response = await fetch(
    `https://api.webflow.com/v2/collections/${collectionId}/items?limit=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    console.error('Failed to fetch tags:', response.statusText);
    return 0;
  }

  const data = (await response.json()) as WebflowListResponse;
  const now = new Date().toISOString();
  let count = 0;

  for (const item of data.items || []) {
    const fieldData = item.fieldData as unknown as WebflowTagFieldData;

    // Check if tag exists
    const existing = await db
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.webflowItemId, item.id))
      .get();

    if (existing) {
      // Update
      await db
        .update(tags)
        .set({
          name: fieldData.name,
          slug: fieldData.slug,
        })
        .where(eq(tags.webflowItemId, item.id));
    } else {
      // Insert
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

async function syncPodcasts(
  db: ReturnType<typeof getDb>,
  collectionId: string,
  token: string
): Promise<number> {
  const response = await fetch(
    `https://api.webflow.com/v2/collections/${collectionId}/items?limit=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch podcasts: ${response.statusText}`);
  }

  const data = (await response.json()) as WebflowListResponse;
  const now = new Date().toISOString();
  let count = 0;

  for (const item of data.items || []) {
    const fieldData = item.fieldData as unknown as WebflowPodcastFieldData;

    // Parse coordinates
    const latitude =
      typeof fieldData['latitude-2'] === 'string'
        ? parseFloat(fieldData['latitude-2'])
        : fieldData['latitude-2'];
    const longitude =
      typeof fieldData['longitude-2'] === 'string'
        ? parseFloat(fieldData['longitude-2'])
        : fieldData['longitude-2'];

    if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
      console.log('Skipping podcast without valid coordinates:', item.id);
      continue;
    }

    // Parse YouTube link
    const youtubeLink =
      typeof fieldData['youtube-link'] === 'object'
        ? fieldData['youtube-link']?.url
        : fieldData['youtube-link'];

    // Check if podcast exists
    const existing = await db
      .select({ id: podcasts.id })
      .from(podcasts)
      .where(eq(podcasts.webflowItemId, item.id))
      .get();

    let podcastId: string;

    if (existing) {
      podcastId = existing.id;
      // Update
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
        .where(eq(podcasts.webflowItemId, item.id));
    } else {
      podcastId = crypto.randomUUID();
      // Insert
      await db.insert(podcasts).values({
        id: podcastId,
        webflowItemId: item.id,
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
    }

    // Sync tags
    if (fieldData.tags && Array.isArray(fieldData.tags)) {
      // Delete existing tags
      await db.delete(podcastTags).where(eq(podcastTags.podcastId, podcastId));

      // Add new tags
      for (const tagWebflowId of fieldData.tags) {
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

    count++;
  }

  return count;
}
