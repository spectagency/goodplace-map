import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb, initiatives, tags, initiativeTags } from '@/db';
import { asc, eq, inArray } from 'drizzle-orm';
import { type WebflowEnv } from '@/lib/podcasts';
import { getInitiativesFromWebflow, getInitiativeTagsFromWebflow } from '@/lib/initiatives';

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
      return Response.json({ error: 'Failed to fetch initiatives' }, { status: 500 });
    }
  }
}

async function fetchFromDatabase(
  env: { DB: D1Database },
  tagIds: string[]
): Promise<Response> {
  const db = getDb(env.DB);

  let initiativeList;

  if (tagIds.length > 0) {
    // Filter by tags - get initiative IDs that have any of the specified tags
    const initiativeIdsWithTags = await db
      .selectDistinct({ initiativeId: initiativeTags.initiativeId })
      .from(initiativeTags)
      .where(inArray(initiativeTags.tagId, tagIds));

    const initiativeIds = initiativeIdsWithTags.map((i) => i.initiativeId);

    if (initiativeIds.length === 0) {
      return Response.json([]);
    }

    initiativeList = await db
      .select()
      .from(initiatives)
      .where(inArray(initiatives.id, initiativeIds))
      .orderBy(asc(initiatives.eventDate));
  } else {
    // No filter - get all initiatives
    initiativeList = await db
      .select()
      .from(initiatives)
      .orderBy(asc(initiatives.eventDate));
  }

  // Fetch tags for each initiative
  const initiativesWithTags = await Promise.all(
    initiativeList.map(async (initiative) => {
      const initiativeTagList = await db
        .select({
          id: tags.id,
          name: tags.name,
          slug: tags.slug,
        })
        .from(tags)
        .innerJoin(initiativeTags, eq(tags.id, initiativeTags.tagId))
        .where(eq(initiativeTags.initiativeId, initiative.id));

      return {
        ...initiative,
        type: 'initiative' as const,
        tags: initiativeTagList,
      };
    })
  );

  return Response.json(initiativesWithTags);
}

async function fetchFromWebflow(
  env: WebflowEnv,
  tagIds: string[]
): Promise<Response> {
  const webflowEnv: WebflowEnv = {
    WEBFLOW_SITE_API_TOKEN: env.WEBFLOW_SITE_API_TOKEN,
    WEBFLOW_STORIES_COLLECTION_ID: env.WEBFLOW_STORIES_COLLECTION_ID,
    WEBFLOW_INITIATIVES_COLLECTION_ID: env.WEBFLOW_INITIATIVES_COLLECTION_ID,
    WEBFLOW_INITIATIVE_TAGS_COLLECTION_ID: env.WEBFLOW_INITIATIVE_TAGS_COLLECTION_ID,
  };

  // Fetch initiative tags
  const allTags = await getInitiativeTagsFromWebflow(webflowEnv);

  // Fetch initiatives with optional tag filter
  const initiativeList = await getInitiativesFromWebflow(
    webflowEnv,
    allTags,
    tagIds.length > 0 ? tagIds : undefined
  );

  return Response.json(initiativeList);
}
