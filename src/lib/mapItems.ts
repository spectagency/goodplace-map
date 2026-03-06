import type { MapItem, Podcast, Place, Initiative, Tag, ContentType } from '@/types';
import type { WebflowEnv } from './shared';
import { getPodcastsFromWebflow, getTagsFromWebflow } from './podcasts';
import { getPlacesFromWebflow } from './places';
import { getInitiativesFromWebflow } from './initiatives';

export interface AllMapItems {
  podcasts: Podcast[];
  places: Place[];
  initiatives: Initiative[];
  tags: Tag[];
}

/**
 * Fetch all map items from Webflow API
 */
export async function getAllMapItemsFromWebflow(
  env: WebflowEnv,
  filterTagIds?: string[],
  filterContentTypes?: ContentType[]
): Promise<AllMapItems> {
  // Determine which content types to fetch
  const shouldFetchPodcasts = !filterContentTypes || filterContentTypes.includes('podcast');
  const shouldFetchPlaces = !filterContentTypes || filterContentTypes.includes('place');
  const shouldFetchInitiatives = !filterContentTypes || filterContentTypes.includes('initiative');

  // Fetch tags from central collection
  const tags = await getTagsFromWebflow(env);

  // Fetch all content types in parallel (all sharing the same tags)
  const [podcasts, places, initiatives] = await Promise.all([
    shouldFetchPodcasts ? getPodcastsFromWebflow(env, tags, filterTagIds) : Promise.resolve([]),
    shouldFetchPlaces ? getPlacesFromWebflow(env, tags, filterTagIds) : Promise.resolve([]),
    shouldFetchInitiatives ? getInitiativesFromWebflow(env, tags, filterTagIds) : Promise.resolve([]),
  ]);

  return {
    podcasts,
    places,
    initiatives,
    tags,
  };
}

/**
 * Combine all map items into a single array
 */
export function combineMapItems(items: AllMapItems): MapItem[] {
  return [...items.podcasts, ...items.places, ...items.initiatives];
}

/**
 * Filter map items by content type
 */
export function filterByContentType(
  items: MapItem[],
  types: ContentType[]
): MapItem[] {
  if (types.length === 0) return items;
  return items.filter((item) => types.includes(item.type));
}

/**
 * Filter map items by tag
 */
export function filterByTags(
  items: MapItem[],
  tagIds: string[]
): MapItem[] {
  if (tagIds.length === 0) return items;
  return items.filter((item) =>
    item.tags.some((tag) => tagIds.includes(tag.id))
  );
}

/**
 * Find a map item by slug and type
 */
export function findItemBySlug(
  items: AllMapItems,
  slug: string,
  type?: ContentType
): MapItem | null {
  if (type === 'podcast' || !type) {
    const podcast = items.podcasts.find((p) => p.slug === slug);
    if (podcast) return podcast;
  }
  if (type === 'place' || !type) {
    const place = items.places.find((p) => p.slug === slug);
    if (place) return place;
  }
  if (type === 'initiative' || !type) {
    const initiative = items.initiatives.find((i) => i.slug === slug);
    if (initiative) return initiative;
  }
  return null;
}

/**
 * Get a random map item (optionally excluding a specific slug)
 */
export function getRandomMapItem(
  items: AllMapItems,
  excludeSlug?: string
): MapItem | null {
  const all = combineMapItems(items);
  const filtered = excludeSlug
    ? all.filter((item) => item.slug !== excludeSlug)
    : all;

  if (filtered.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * filtered.length);
  return filtered[randomIndex];
}
