import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb, tags } from '@/db';
import { asc } from 'drizzle-orm';

export const runtime = 'edge';

export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  try {
    const tagList = await db
      .select()
      .from(tags)
      .orderBy(asc(tags.name));

    return Response.json(tagList);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return Response.json({ error: 'Failed to fetch tags' }, { status: 500 });
  }
}
