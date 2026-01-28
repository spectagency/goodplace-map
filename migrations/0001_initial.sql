-- Podcasts table
CREATE TABLE podcasts (
  id TEXT PRIMARY KEY,
  webflow_item_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  thumbnail_url TEXT,
  youtube_link TEXT,
  spotify_link TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  location_name TEXT,
  published_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Tags table
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  webflow_item_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT
);

-- Junction table for many-to-many relationship
CREATE TABLE podcast_tags (
  podcast_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (podcast_id, tag_id),
  FOREIGN KEY (podcast_id) REFERENCES podcasts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Indexes for faster queries
CREATE INDEX idx_podcast_tags_tag_id ON podcast_tags(tag_id);
CREATE INDEX idx_podcast_tags_podcast_id ON podcast_tags(podcast_id);
CREATE INDEX idx_podcasts_coordinates ON podcasts(latitude, longitude);
CREATE INDEX idx_podcasts_webflow_id ON podcasts(webflow_item_id);
CREATE INDEX idx_tags_webflow_id ON tags(webflow_item_id);
