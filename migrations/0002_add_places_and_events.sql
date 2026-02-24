-- Migration: Add places and events tables
-- Description: Add support for Good Places and Good Events content types

-- ============================================
-- PLACES TABLE (Good Places - cafes, venues, etc.)
-- ============================================
CREATE TABLE places (
  id TEXT PRIMARY KEY,
  webflow_item_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  thumbnail_url TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  location_name TEXT,
  address TEXT,
  website_url TEXT,
  opening_hours TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Place tags junction table
CREATE TABLE place_tags (
  place_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (place_id, tag_id),
  FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Indexes for places
CREATE INDEX idx_places_coordinates ON places(latitude, longitude);
CREATE INDEX idx_places_webflow_id ON places(webflow_item_id);
CREATE INDEX idx_place_tags_tag_id ON place_tags(tag_id);
CREATE INDEX idx_place_tags_place_id ON place_tags(place_id);

-- ============================================
-- EVENTS TABLE (Good Events - with Google Playlist)
-- ============================================
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  webflow_item_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  thumbnail_url TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  location_name TEXT,
  event_date TEXT,
  end_date TEXT,
  google_playlist_url TEXT,
  event_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Event tags junction table
CREATE TABLE event_tags (
  event_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (event_id, tag_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Indexes for events
CREATE INDEX idx_events_coordinates ON events(latitude, longitude);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_webflow_id ON events(webflow_item_id);
CREATE INDEX idx_event_tags_tag_id ON event_tags(tag_id);
CREATE INDEX idx_event_tags_event_id ON event_tags(event_id);
