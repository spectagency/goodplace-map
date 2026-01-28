import { sqliteTable, text, real, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const podcasts = sqliteTable('podcasts', {
  id: text('id').primaryKey(),
  webflowItemId: text('webflow_item_id').unique().notNull(),
  title: text('title').notNull(),
  slug: text('slug'),
  description: text('description'),
  thumbnailUrl: text('thumbnail_url'),
  youtubeLink: text('youtube_link'),
  spotifyLink: text('spotify_link'),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  locationName: text('location_name'),
  publishedAt: text('published_at'),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
}, (table) => [
  index('idx_podcasts_coordinates').on(table.latitude, table.longitude),
]);

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  webflowItemId: text('webflow_item_id').unique().notNull(),
  name: text('name').notNull(),
  slug: text('slug'),
});

export const podcastTags = sqliteTable('podcast_tags', {
  podcastId: text('podcast_id').notNull().references(() => podcasts.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.podcastId, table.tagId] }),
  index('idx_podcast_tags_tag_id').on(table.tagId),
  index('idx_podcast_tags_podcast_id').on(table.podcastId),
]);

export type Podcast = typeof podcasts.$inferSelect;
export type NewPodcast = typeof podcasts.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
