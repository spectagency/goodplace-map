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
  const collectionId = env.WEBFLOW_TAGS_COLLECTION_ID;

  if (!collectionId) {
    return Response.json({ error: 'Missing WEBFLOW_TAGS_COLLECTION_ID' }, { status: 500 });
  }

  const tagList = await fetchTagsFromCollection(token, collectionId);

  return Response.json(tagList);
}
