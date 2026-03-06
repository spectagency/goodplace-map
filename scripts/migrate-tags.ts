/**
 * Migrate tags from 3 separate Webflow CMS collections into one central Tags collection.
 *
 * Prerequisites:
 *   1. Create a new "Tags" collection in Webflow CMS
 *   2. Add a multi-reference field on each content collection pointing to the new Tags collection
 *   3. Set the env vars below (in .env or inline)
 *
 * Usage:
 *   npx tsx scripts/migrate-tags.ts --dry-run    # preview what will happen
 *   npx tsx scripts/migrate-tags.ts              # execute the migration
 */

import 'dotenv/config';

// ============================================
// Configuration
// ============================================

const TOKEN = process.env.WEBFLOW_SITE_API_WRITE_TOKEN || process.env.WEBFLOW_SITE_API_TOKEN!;

// Old tag collection IDs (source)
const OLD_TAG_COLLECTIONS = {
  storyTags: process.env.WEBFLOW_STORY_TAGS_COLLECTION_ID!,
  placeTags: process.env.WEBFLOW_PLACE_TAGS_COLLECTION_ID!,
  initiativeTags: process.env.WEBFLOW_INITIATIVE_TAGS_COLLECTION_ID!,
};

// New central tags collection ID (target — set this after creating the collection)
const NEW_TAGS_COLLECTION_ID = process.env.WEBFLOW_TAGS_COLLECTION_ID;

// Content collection IDs
const CONTENT_COLLECTIONS = {
  stories: {
    collectionId: process.env.WEBFLOW_STORIES_COLLECTION_ID!,
    oldTagField: 'episode-tags',
    newTagField: 'content-tags',
  },
  places: {
    collectionId: process.env.WEBFLOW_PLACES_COLLECTION_ID!,
    oldTagField: 'tags',
    newTagField: 'content-tags',
  },
  initiatives: {
    collectionId: process.env.WEBFLOW_INITIATIVES_COLLECTION_ID!,
    oldTagField: 'initiative-tags-2',
    newTagField: 'content-tags',
  },
};

const DRY_RUN = process.argv.includes('--dry-run');

// Webflow API rate limit: ~60 requests/min — add delay between writes
const API_DELAY_MS = 1100;

// ============================================
// Types
// ============================================

interface WebflowItem {
  id: string;
  fieldData: Record<string, unknown>;
}

interface TagInfo {
  id: string;
  name: string;
  slug?: string;
  sourceCollection: string;
}

// ============================================
// Helpers
// ============================================

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAllItems(collectionId: string): Promise<WebflowItem[]> {
  const items: WebflowItem[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const res = await fetch(
      `https://api.webflow.com/v2/collections/${collectionId}/items?limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch items from ${collectionId}: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as { items: WebflowItem[]; pagination?: { total?: number } };
    items.push(...data.items);

    if (data.items.length < limit) break;
    offset += limit;
    await sleep(300);
  }

  return items;
}

async function createCollectionItem(
  collectionId: string,
  fieldData: Record<string, unknown>
): Promise<WebflowItem> {
  const res = await fetch(
    `https://api.webflow.com/v2/collections/${collectionId}/items`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fieldData, isArchived: false, isDraft: false }),
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to create item in ${collectionId}: ${res.status} ${await res.text()}`);
  }

  return (await res.json()) as WebflowItem;
}

async function updateCollectionItem(
  collectionId: string,
  itemId: string,
  fieldData: Record<string, unknown>
): Promise<void> {
  const res = await fetch(
    `https://api.webflow.com/v2/collections/${collectionId}/items/${itemId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fieldData }),
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to update item ${itemId} in ${collectionId}: ${res.status} ${await res.text()}`);
  }
}

// ============================================
// Migration steps
// ============================================

async function main() {
  if (!TOKEN) {
    console.error('Missing WEBFLOW_SITE_API_TOKEN');
    process.exit(1);
  }

  if (!NEW_TAGS_COLLECTION_ID) {
    console.error('Missing WEBFLOW_TAGS_COLLECTION_ID — create the new central Tags collection in Webflow first');
    process.exit(1);
  }

  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== LIVE MIGRATION ===');
  console.log();

  // Step 1: Fetch all tags from the 3 old collections
  console.log('Step 1: Fetching tags from old collections...');
  const allOldTags: TagInfo[] = [];

  for (const [label, collectionId] of Object.entries(OLD_TAG_COLLECTIONS)) {
    if (!collectionId) {
      console.log(`  Skipping ${label} (no collection ID)`);
      continue;
    }
    const items = await fetchAllItems(collectionId);
    for (const item of items) {
      allOldTags.push({
        id: item.id,
        name: (item.fieldData.name as string) || '',
        slug: item.fieldData.slug as string | undefined,
        sourceCollection: label,
      });
    }
    console.log(`  ${label}: ${items.length} tags`);
  }

  console.log(`  Total old tags: ${allOldTags.length}`);
  console.log();

  // Step 2: Deduplicate by name (case-insensitive)
  console.log('Step 2: Deduplicating tags by name...');
  const uniqueTagsByName = new Map<string, TagInfo>();
  const oldIdToCanonicalName = new Map<string, string>();
  const duplicates: { name: string; sources: string[] }[] = [];

  for (const tag of allOldTags) {
    const normalizedName = tag.name.trim().toLowerCase();
    const existing = uniqueTagsByName.get(normalizedName);

    if (existing) {
      // Track duplicate
      const dupEntry = duplicates.find((d) => d.name === normalizedName);
      if (dupEntry) {
        dupEntry.sources.push(tag.sourceCollection);
      } else {
        duplicates.push({
          name: normalizedName,
          sources: [existing.sourceCollection, tag.sourceCollection],
        });
      }
    } else {
      uniqueTagsByName.set(normalizedName, tag);
    }

    oldIdToCanonicalName.set(tag.id, normalizedName);
  }

  console.log(`  Unique tags: ${uniqueTagsByName.size}`);
  if (duplicates.length > 0) {
    console.log(`  Duplicates found:`);
    for (const dup of duplicates) {
      console.log(`    "${dup.name}" — found in: ${dup.sources.join(', ')}`);
    }
  } else {
    console.log('  No duplicates found');
  }
  console.log();

  // Step 3: Create deduplicated tags in the new central collection
  console.log('Step 3: Creating tags in new central collection...');

  // First check what already exists in the new collection
  const existingNewTags = await fetchAllItems(NEW_TAGS_COLLECTION_ID);
  const existingNewTagsByName = new Map<string, string>();
  for (const item of existingNewTags) {
    const name = ((item.fieldData.name as string) || '').trim().toLowerCase();
    existingNewTagsByName.set(name, item.id);
  }
  console.log(`  Already existing in new collection: ${existingNewTags.length}`);

  // Map: normalized name → new tag ID
  const nameToNewId = new Map<string, string>();

  // Populate with already-existing tags
  for (const [name, id] of existingNewTagsByName) {
    nameToNewId.set(name, id);
  }

  // Create missing tags
  let createdCount = 0;
  for (const [normalizedName, tagInfo] of uniqueTagsByName) {
    if (nameToNewId.has(normalizedName)) {
      console.log(`  "${tagInfo.name}" — already exists, skipping`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would create: "${tagInfo.name}" (slug: ${tagInfo.slug || 'auto'})`);
      nameToNewId.set(normalizedName, `dry-run-${createdCount}`);
    } else {
      const created = await createCollectionItem(NEW_TAGS_COLLECTION_ID, {
        name: tagInfo.name,
        slug: tagInfo.slug || tagInfo.name.toLowerCase().replace(/\s+/g, '-'),
      });
      nameToNewId.set(normalizedName, created.id);
      console.log(`  Created: "${tagInfo.name}" → ${created.id}`);
      await sleep(API_DELAY_MS);
    }
    createdCount++;
  }

  console.log(`  Created ${createdCount} new tags`);
  console.log();

  // Build the old ID → new ID mapping
  const oldIdToNewId = new Map<string, string>();
  for (const [oldId, normalizedName] of oldIdToCanonicalName) {
    const newId = nameToNewId.get(normalizedName);
    if (newId) {
      oldIdToNewId.set(oldId, newId);
    }
  }

  // Step 4: Retag all content items
  console.log('Step 4: Retagging content items...');

  let totalRetagged = 0;
  let totalSkipped = 0;
  const failures: { type: string; itemId: string; error: string }[] = [];

  for (const [contentType, config] of Object.entries(CONTENT_COLLECTIONS)) {
    if (!config.collectionId) {
      console.log(`  Skipping ${contentType} (no collection ID)`);
      continue;
    }

    console.log(`  Processing ${contentType}...`);
    const items = await fetchAllItems(config.collectionId);
    console.log(`    Found ${items.length} items`);

    for (const item of items) {
      const oldTagIds = (item.fieldData[config.oldTagField] as string[]) || [];

      if (oldTagIds.length === 0) {
        totalSkipped++;
        continue;
      }

      // Map old tag IDs to new tag IDs
      const newTagIds = oldTagIds
        .map((oldId) => oldIdToNewId.get(oldId))
        .filter((id): id is string => id !== undefined);

      const unmapped = oldTagIds.filter((oldId) => !oldIdToNewId.has(oldId));
      if (unmapped.length > 0) {
        console.log(`    WARNING: Item "${item.fieldData.name}" has ${unmapped.length} unmapped tag(s): ${unmapped.join(', ')}`);
      }

      if (newTagIds.length === 0) {
        totalSkipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`    [DRY RUN] "${item.fieldData.name}": ${oldTagIds.length} old tags → ${newTagIds.length} new tags`);
      } else {
        try {
          await updateCollectionItem(config.collectionId, item.id, {
            [config.newTagField]: newTagIds,
          });
          console.log(`    Retagged: "${item.fieldData.name}" (${newTagIds.length} tags)`);
          await sleep(API_DELAY_MS);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`    FAILED: "${item.fieldData.name}" — ${msg}`);
          failures.push({ type: contentType, itemId: item.id, error: msg });
        }
      }

      totalRetagged++;
    }
  }

  // Summary
  console.log();
  console.log('=== SUMMARY ===');
  console.log(`Tags deduplicated: ${allOldTags.length} → ${uniqueTagsByName.size}`);
  console.log(`Tags created in new collection: ${createdCount}`);
  console.log(`Content items retagged: ${totalRetagged}`);
  console.log(`Content items skipped (no tags): ${totalSkipped}`);

  if (failures.length > 0) {
    console.log(`Failures: ${failures.length}`);
    for (const f of failures) {
      console.log(`  ${f.type} ${f.itemId}: ${f.error}`);
    }
  } else {
    console.log('Failures: 0');
  }

  if (DRY_RUN) {
    console.log();
    console.log('This was a dry run. Run without --dry-run to execute.');
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
