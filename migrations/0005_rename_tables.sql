-- Migration: Rename podcasts -> stories and events -> initiatives
-- Description: Align table names with the actual content type naming

-- ============================================
-- Rename podcasts -> stories
-- ============================================

-- Drop indexes that reference old table name
DROP INDEX IF EXISTS idx_podcasts_coordinates;
DROP INDEX IF EXISTS idx_podcasts_webflow_id;
DROP INDEX IF EXISTS idx_podcast_tags_tag_id;
DROP INDEX IF EXISTS idx_podcast_tags_podcast_id;

-- Rename main table
ALTER TABLE podcasts RENAME TO stories;

-- Rename junction table
ALTER TABLE podcast_tags RENAME TO story_tags;

-- Rename column in junction table
ALTER TABLE story_tags RENAME COLUMN podcast_id TO story_id;

-- Recreate indexes with new names
CREATE INDEX idx_stories_coordinates ON stories(latitude, longitude);
CREATE INDEX idx_stories_webflow_id ON stories(webflow_item_id);
CREATE INDEX idx_story_tags_tag_id ON story_tags(tag_id);
CREATE INDEX idx_story_tags_story_id ON story_tags(story_id);

-- ============================================
-- Rename events -> initiatives
-- ============================================

-- Drop indexes that reference old table name
DROP INDEX IF EXISTS idx_events_coordinates;
DROP INDEX IF EXISTS idx_events_date;
DROP INDEX IF EXISTS idx_events_webflow_id;
DROP INDEX IF EXISTS idx_event_tags_tag_id;
DROP INDEX IF EXISTS idx_event_tags_event_id;

-- Rename main table
ALTER TABLE events RENAME TO initiatives;

-- Rename junction table
ALTER TABLE event_tags RENAME TO initiative_tags;

-- Rename column in junction table
ALTER TABLE initiative_tags RENAME COLUMN event_id TO initiative_id;

-- Recreate indexes with new names
CREATE INDEX idx_initiatives_coordinates ON initiatives(latitude, longitude);
CREATE INDEX idx_initiatives_date ON initiatives(event_date);
CREATE INDEX idx_initiatives_webflow_id ON initiatives(webflow_item_id);
CREATE INDEX idx_initiative_tags_tag_id ON initiative_tags(tag_id);
CREATE INDEX idx_initiative_tags_initiative_id ON initiative_tags(initiative_id);
