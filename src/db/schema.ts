import { sqliteTable, text, real, primaryKey, index } from 'drizzle-orm/sqlite-core';

// ============================================
// PODCASTS
// ============================================
export const podcasts = sqliteTable('podcasts', {
  id: text('id').primaryKey(),
  webflowItemId: text('webflow_item_id').unique().notNull(),
  title: text('title').notNull(),
  slug: text('slug'),
  description: text('description'),
  thumbnailUrl: text('thumbnail_url'),
  mainImageUrl: text('main_image_url'),
  youtubeLink: text('youtube_link'),
  buttonText: text('button_text'),
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

export const podcastTags = sqliteTable('podcast_tags', {
  podcastId: text('podcast_id').notNull().references(() => podcasts.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.podcastId, table.tagId] }),
  index('idx_podcast_tags_tag_id').on(table.tagId),
  index('idx_podcast_tags_podcast_id').on(table.podcastId),
]);

// ============================================
// PLACES (Good Places - cafes, venues, etc.)
// ============================================
export const places = sqliteTable('places', {
  id: text('id').primaryKey(),
  webflowItemId: text('webflow_item_id').unique().notNull(),
  title: text('title').notNull(),
  slug: text('slug'),
  description: text('description'),
  thumbnailUrl: text('thumbnail_url'),
  mainImageUrl: text('main_image_url'),
  youtubeLink: text('youtube_link'),
  buttonText: text('button_text'),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  locationName: text('location_name'),
  address: text('address'),
  websiteUrl: text('website_url'),
  openingHours: text('opening_hours'),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
}, (table) => [
  index('idx_places_coordinates').on(table.latitude, table.longitude),
]);

export const placeTags = sqliteTable('place_tags', {
  placeId: text('place_id').notNull().references(() => places.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.placeId, table.tagId] }),
  index('idx_place_tags_tag_id').on(table.tagId),
  index('idx_place_tags_place_id').on(table.placeId),
]);

// ============================================
// INITIATIVES (Good Initiatives - with Google Playlist)
// ============================================
export const initiatives = sqliteTable('events', {
  id: text('id').primaryKey(),
  webflowItemId: text('webflow_item_id').unique().notNull(),
  title: text('title').notNull(),
  slug: text('slug'),
  description: text('description'),
  thumbnailUrl: text('thumbnail_url'),
  mainImageUrl: text('main_image_url'),
  youtubeLink: text('youtube_link'),
  buttonText: text('button_text'),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  locationName: text('location_name'),
  eventDate: text('event_date'),
  endDate: text('end_date'),
  googlePlaylistUrl: text('google_playlist_url'),
  eventUrl: text('event_url'),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
}, (table) => [
  index('idx_events_coordinates').on(table.latitude, table.longitude),
  index('idx_events_date').on(table.eventDate),
]);

export const initiativeTags = sqliteTable('event_tags', {
  initiativeId: text('event_id').notNull().references(() => initiatives.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.initiativeId, table.tagId] }),
  index('idx_event_tags_tag_id').on(table.tagId),
  index('idx_event_tags_event_id').on(table.initiativeId),
]);

// ============================================
// TAGS (shared across all content types)
// ============================================
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  webflowItemId: text('webflow_item_id').unique().notNull(),
  name: text('name').notNull(),
  slug: text('slug'),
});

// ============================================
// Type exports
// ============================================
export type DbPodcast = typeof podcasts.$inferSelect;
export type NewPodcast = typeof podcasts.$inferInsert;
export type DbPlace = typeof places.$inferSelect;
export type NewPlace = typeof places.$inferInsert;
export type DbInitiative = typeof initiatives.$inferSelect;
export type NewInitiative = typeof initiatives.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
