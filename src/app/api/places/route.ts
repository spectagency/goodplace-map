import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb, places, tags, placeTags } from '@/db';
import { asc, eq, inArray } from 'drizzle-orm';
import { type WebflowEnv } from '@/lib/podcasts';
import { getPlacesFromWebflow, getPlaceTagsFromWebflow } from '@/lib/places';

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
      return Response.json({ error: 'Failed to fetch places' }, { status: 500 });
    }
  }
}

async function fetchFromDatabase(
  env: { DB: D1Database },
  tagIds: string[]
): Promise<Response> {
  const db = getDb(env.DB);

  let placeList;

  if (tagIds.length > 0) {
    // Filter by tags - get place IDs that have any of the specified tags
    const placeIdsWithTags = await db
      .selectDistinct({ placeId: placeTags.placeId })
      .from(placeTags)
      .where(inArray(placeTags.tagId, tagIds));

    const placeIds = placeIdsWithTags.map((p) => p.placeId);

    if (placeIds.length === 0) {
      return Response.json([]);
    }

    placeList = await db
      .select()
      .from(places)
      .where(inArray(places.id, placeIds))
      .orderBy(asc(places.title));
  } else {
    // No filter - get all places
    placeList = await db
      .select()
      .from(places)
      .orderBy(asc(places.title));
  }

  // Fetch tags for each place
  const placesWithTags = await Promise.all(
    placeList.map(async (place) => {
      const placeTagList = await db
        .select({
          id: tags.id,
          name: tags.name,
          slug: tags.slug,
        })
        .from(tags)
        .innerJoin(placeTags, eq(tags.id, placeTags.tagId))
        .where(eq(placeTags.placeId, place.id));

      return {
        ...place,
        type: 'place' as const,
        tags: placeTagList,
      };
    })
  );

  return Response.json(placesWithTags);
}

async function fetchFromWebflow(
  env: WebflowEnv,
  tagIds: string[]
): Promise<Response> {
  const webflowEnv: WebflowEnv = {
    WEBFLOW_SITE_API_TOKEN: env.WEBFLOW_SITE_API_TOKEN,
    WEBFLOW_STORIES_COLLECTION_ID: env.WEBFLOW_STORIES_COLLECTION_ID,
    WEBFLOW_PLACES_COLLECTION_ID: env.WEBFLOW_PLACES_COLLECTION_ID,
    WEBFLOW_PLACE_TAGS_COLLECTION_ID: env.WEBFLOW_PLACE_TAGS_COLLECTION_ID,
  };

  // Fetch place tags
  const allTags = await getPlaceTagsFromWebflow(webflowEnv);

  // Fetch places with optional tag filter
  const placeList = await getPlacesFromWebflow(
    webflowEnv,
    allTags,
    tagIds.length > 0 ? tagIds : undefined
  );

  return Response.json(placeList);
}
