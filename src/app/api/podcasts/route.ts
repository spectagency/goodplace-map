import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb, podcasts, tags, podcastTags } from '@/db';
import { desc, eq, inArray } from 'drizzle-orm';
import {
  getTagsFromWebflow,
  getPodcastsFromWebflow,
  type WebflowEnv,
} from '@/lib/podcasts';

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });

  // Get URL params for filtering
  const { searchParams } = new URL(request.url);
  const tagIds = searchParams.get('tags')?.split(',').filter(Boolean) || [];

  // Try database first, fall back to Webflow API
  try {
    return await fetchFromDatabase(env, tagIds);
  } catch (dbError) {
    console.error('Database fetch failed, falling back to Webflow API:', dbError);

    try {
      return await fetchFromWebflow(env as unknown as WebflowEnv, tagIds);
    } catch (webflowError) {
      console.error('Webflow API fallback also failed:', webflowError);
      return Response.json({ error: 'Failed to fetch podcasts' }, { status: 500 });
    }
  }
}

async function fetchFromDatabase(
  env: { DB: D1Database },
  tagIds: string[]
): Promise<Response> {
  const db = getDb(env.DB);

  let podcastList;

  if (tagIds.length > 0) {
    // Filter by tags - get podcast IDs that have any of the specified tags
    const podcastIdsWithTags = await db
      .selectDistinct({ podcastId: podcastTags.podcastId })
      .from(podcastTags)
      .where(inArray(podcastTags.tagId, tagIds));

    const podcastIds = podcastIdsWithTags.map((p) => p.podcastId);

    if (podcastIds.length === 0) {
      return Response.json([]);
    }

    podcastList = await db
      .select()
      .from(podcasts)
      .where(inArray(podcasts.id, podcastIds))
      .orderBy(desc(podcasts.publishedAt));
  } else {
    // No filter - get all podcasts
    podcastList = await db
      .select()
      .from(podcasts)
      .orderBy(desc(podcasts.publishedAt));
  }

  // Fetch tags for each podcast
  const podcastsWithTags = await Promise.all(
    podcastList.map(async (podcast) => {
      const podcastTagList = await db
        .select({
          id: tags.id,
          name: tags.name,
          slug: tags.slug,
        })
        .from(tags)
        .innerJoin(podcastTags, eq(tags.id, podcastTags.tagId))
        .where(eq(podcastTags.podcastId, podcast.id));

      return {
        ...podcast,
        type: 'podcast' as const,
        tags: podcastTagList,
      };
    })
  );

  return Response.json(podcastsWithTags);
}

async function fetchFromWebflow(
  env: WebflowEnv,
  tagIds: string[]
): Promise<Response> {
  const webflowEnv: WebflowEnv = {
    WEBFLOW_SITE_API_TOKEN: env.WEBFLOW_SITE_API_TOKEN,
    WEBFLOW_COLLECTION_ID: env.WEBFLOW_COLLECTION_ID,
    WEBFLOW_TAGS_COLLECTION_ID: env.WEBFLOW_TAGS_COLLECTION_ID,
  };

  // Fetch tags first (needed to map tag IDs to tag objects in podcasts)
  const allTags = await getTagsFromWebflow(webflowEnv);

  // Fetch podcasts with optional tag filter
  const podcastList = await getPodcastsFromWebflow(
    webflowEnv,
    allTags,
    tagIds.length > 0 ? tagIds : undefined
  );

  return Response.json(podcastList);
}
