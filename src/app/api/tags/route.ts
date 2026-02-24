import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb, tags } from '@/db';
import { asc } from 'drizzle-orm';
import { fetchTagsFromCollection, type WebflowEnv } from '@/lib/shared';

export async function GET() {
  const { env } = await getCloudflareContext({ async: true });

  // Try database first, fall back to Webflow API
  try {
    return await fetchFromDatabase(env);
  } catch (dbError) {
    console.error('Database fetch failed, falling back to Webflow API:', dbError);

    try {
      return await fetchFromWebflow(env as unknown as WebflowEnv);
    } catch (webflowError) {
      console.error('Webflow API fallback also failed:', webflowError);
      return Response.json({ error: 'Failed to fetch tags' }, { status: 500 });
    }
  }
}

async function fetchFromDatabase(env: { DB: D1Database }): Promise<Response> {
  const db = getDb(env.DB);

  const tagList = await db
    .select()
    .from(tags)
    .orderBy(asc(tags.name));

  return Response.json(tagList);
}

async function fetchFromWebflow(env: WebflowEnv): Promise<Response> {
  const token = env.WEBFLOW_SITE_API_TOKEN;

  // Fetch tags from all tag collections in parallel
  const collectionIds = [
    env.WEBFLOW_STORY_TAGS_COLLECTION_ID,
    env.WEBFLOW_PLACE_TAGS_COLLECTION_ID,
    env.WEBFLOW_INITIATIVE_TAGS_COLLECTION_ID,
  ].filter((id): id is string => !!id);

  const tagArrays = await Promise.all(
    collectionIds.map((id) => fetchTagsFromCollection(token, id))
  );

  // Deduplicate by ID
  const allTagsMap = new Map<string, (typeof tagArrays)[0][0]>();
  for (const tagArray of tagArrays) {
    for (const tag of tagArray) {
      allTagsMap.set(tag.id, tag);
    }
  }

  const tagList = Array.from(allTagsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return Response.json(tagList);
}
