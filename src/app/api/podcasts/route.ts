import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb, stories, tags, storyTags } from '@/db';
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

  let storyList;

  if (tagIds.length > 0) {
    // Filter by tags - get story IDs that have any of the specified tags
    const storyIdsWithTags = await db
      .selectDistinct({ storyId: storyTags.storyId })
      .from(storyTags)
      .where(inArray(storyTags.tagId, tagIds));

    const storyIds = storyIdsWithTags.map((s) => s.storyId);

    if (storyIds.length === 0) {
      return Response.json([]);
    }

    storyList = await db
      .select()
      .from(stories)
      .where(inArray(stories.id, storyIds))
      .orderBy(desc(stories.publishedAt));
  } else {
    // No filter - get all stories
    storyList = await db
      .select()
      .from(stories)
      .orderBy(desc(stories.publishedAt));
  }

  // Fetch tags for each story
  const storiesWithTags = await Promise.all(
    storyList.map(async (story) => {
      const storyTagList = await db
        .select({
          id: tags.id,
          name: tags.name,
          slug: tags.slug,
        })
        .from(tags)
        .innerJoin(storyTags, eq(tags.id, storyTags.tagId))
        .where(eq(storyTags.storyId, story.id));

      return {
        ...story,
        type: 'podcast' as const,
        tags: storyTagList,
      };
    })
  );

  return Response.json(storiesWithTags);
}

async function fetchFromWebflow(
  env: WebflowEnv,
  tagIds: string[]
): Promise<Response> {
  const webflowEnv: WebflowEnv = {
    WEBFLOW_SITE_API_TOKEN: env.WEBFLOW_SITE_API_TOKEN,
    WEBFLOW_STORIES_COLLECTION_ID: env.WEBFLOW_STORIES_COLLECTION_ID,
    WEBFLOW_STORY_TAGS_COLLECTION_ID: env.WEBFLOW_STORY_TAGS_COLLECTION_ID,
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
