-- Migration: Add youtube_link and button_text columns
-- Description: Unify media display and button text across all content types

-- Add youtube_link to places (podcasts already has it, events gets a new one)
ALTER TABLE places ADD COLUMN youtube_link TEXT;

-- Add youtube_link to events (previously only had google_playlist_url)
ALTER TABLE events ADD COLUMN youtube_link TEXT;

-- Add button_text to all content types (CMS-customizable primary button label)
ALTER TABLE podcasts ADD COLUMN button_text TEXT;
ALTER TABLE places ADD COLUMN button_text TEXT;
ALTER TABLE events ADD COLUMN button_text TEXT;
