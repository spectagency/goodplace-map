import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb, podcasts, tags, podcastTags } from '@/db';
import { desc, eq, inArray } from 'drizzle-orm';

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  // Get URL params for filtering
  const { searchParams } = new URL(request.url);
  const tagIds = searchParams.get('tags')?.split(',').filter(Boolean) || [];

  try {
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
          tags: podcastTagList,
        };
      })
    );

    return Response.json(podcastsWithTags);
  } catch (error) {
    console.error('Error fetching podcasts:', error);
    return Response.json({ error: 'Failed to fetch podcasts' }, { status: 500 });
  }
}
