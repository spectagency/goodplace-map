/**
 * Shared data fetching layer: D1 database first, Webflow API fallback.
 *
 * Used by both page.tsx (server component) and API routes so that
 * every data path goes through the DB when available.
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  getDb,
  stories,
  storyTags,
  places,
  placeTags,
  initiatives,
  initiativeTags,
  tags,
} from '@/db';
import { asc, desc, eq } from 'drizzle-orm';
import type { Podcast, Place, Initiative, Tag } from '@/types';
import type { WebflowEnv } from './shared';
import { getPodcastsFromWebflow, getStoryTagsFromWebflow } from './podcasts';
import { getPlacesFromWebflow, getPlaceTagsFromWebflow } from './places';
import { getInitiativesFromWebflow, getInitiativeTagsFromWebflow } from './initiatives';

// ============================================
// Tags
// ============================================

export async function getAllTags(env: WebflowEnv): Promise<{
  storyTags: Tag[];
  placeTags: Tag[];
  initiativeTags: Tag[];
}> {
  try {
    const { env: cfEnv } = await getCloudflareContext({ async: true });
    const db = getDb(cfEnv.DB);

    // Query junction tables to find which tags belong to each content type
    const [storyTagList, placeTagList, initiativeTagList] = await Promise.all([
      db.selectDistinct({ id: tags.id, name: tags.name, slug: tags.slug })
        .from(tags)
        .innerJoin(storyTags, eq(tags.id, storyTags.tagId))
        .orderBy(asc(tags.name)),
      db.selectDistinct({ id: tags.id, name: tags.name, slug: tags.slug })
        .from(tags)
        .innerJoin(placeTags, eq(tags.id, placeTags.tagId))
        .orderBy(asc(tags.name)),
      db.selectDistinct({ id: tags.id, name: tags.name, slug: tags.slug })
        .from(tags)
        .innerJoin(initiativeTags, eq(tags.id, initiativeTags.tagId))
        .orderBy(asc(tags.name)),
    ]);

    if (storyTagList.length > 0 || placeTagList.length > 0 || initiativeTagList.length > 0) {
      return {
        storyTags: storyTagList,
        placeTags: placeTagList,
        initiativeTags: initiativeTagList,
      };
    }
  } catch (e) {
    console.error('DB tag fetch failed, falling back to Webflow API:', e);
  }

  // Fallback: Webflow API
  const [st, pt, it] = await Promise.all([
    getStoryTagsFromWebflow(env),
    getPlaceTagsFromWebflow(env),
    getInitiativeTagsFromWebflow(env),
  ]);
  return { storyTags: st, placeTags: pt, initiativeTags: it };
}

// ============================================
// Stories (podcasts)
// ============================================

export async function getStoriesFromDb(): Promise<Podcast[]> {
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  const storyList = await db
    .select()
    .from(stories)
    .orderBy(desc(stories.publishedAt));

  return Promise.all(
    storyList.map(async (story) => {
      const tagList = await db
        .select({ id: tags.id, name: tags.name, slug: tags.slug })
        .from(tags)
        .innerJoin(storyTags, eq(tags.id, storyTags.tagId))
        .where(eq(storyTags.storyId, story.id));

      return {
        ...story,
        type: 'podcast' as const,
        tags: tagList,
      };
    })
  );
}

export async function getAllStories(env: WebflowEnv, storyTagList: Tag[]): Promise<Podcast[]> {
  try {
    const result = await getStoriesFromDb();
    if (result.length > 0) return result;
  } catch (e) {
    console.error('DB stories fetch failed, falling back to Webflow API:', e);
  }
  return getPodcastsFromWebflow(env, storyTagList);
}

// ============================================
// Places
// ============================================

export async function getPlacesFromDb(): Promise<Place[]> {
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  const placeList = await db
    .select()
    .from(places)
    .orderBy(asc(places.title));

  return Promise.all(
    placeList.map(async (place) => {
      const tagList = await db
        .select({ id: tags.id, name: tags.name, slug: tags.slug })
        .from(tags)
        .innerJoin(placeTags, eq(tags.id, placeTags.tagId))
        .where(eq(placeTags.placeId, place.id));

      return {
        ...place,
        type: 'place' as const,
        tags: tagList,
      };
    })
  );
}

export async function getAllPlaces(env: WebflowEnv, placeTagList: Tag[]): Promise<Place[]> {
  try {
    const result = await getPlacesFromDb();
    if (result.length > 0) return result;
  } catch (e) {
    console.error('DB places fetch failed, falling back to Webflow API:', e);
  }
  return getPlacesFromWebflow(env, placeTagList);
}

// ============================================
// Initiatives
// ============================================

export async function getInitiativesFromDb(): Promise<Initiative[]> {
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  const initiativeList = await db
    .select()
    .from(initiatives)
    .orderBy(asc(initiatives.eventDate));

  return Promise.all(
    initiativeList.map(async (initiative) => {
      const tagList = await db
        .select({ id: tags.id, name: tags.name, slug: tags.slug })
        .from(tags)
        .innerJoin(initiativeTags, eq(tags.id, initiativeTags.tagId))
        .where(eq(initiativeTags.initiativeId, initiative.id));

      return {
        ...initiative,
        type: 'initiative' as const,
        playlistLink: initiative.googlePlaylistUrl,
        tags: tagList,
      };
    })
  );
}

export async function getAllInitiatives(env: WebflowEnv, initiativeTagList: Tag[]): Promise<Initiative[]> {
  try {
    const result = await getInitiativesFromDb();
    if (result.length > 0) return result;
  } catch (e) {
    console.error('DB initiatives fetch failed, falling back to Webflow API:', e);
  }
  return getInitiativesFromWebflow(env, initiativeTagList);
}
