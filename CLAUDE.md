# Good Place - Interactive Map Application

## Project Overview

Good Place is an interactive map web application that displays podcasts recorded at specific locations. Users can explore podcast episodes through map pins or a list view modal, with each episode showing its recording location, details, and embedded media content.

**Note:** This document describes improvements to an existing working prototype. Core structures already exist.

---

## Technical Stack

| Component | Technology |
|-----------|------------|
| **Framework** | Next.js (hosted on Webflow Cloud) |
| **Map Engine** | OpenStreetMap |
| **Map Components** | [MapCN](https://www.mapcn.dev/) - React component library for maps |
| **Data Source** | Webflow CMS (source of truth) |
| **Database** | SQLite on Webflow Cloud (synced copy for fast queries) |
| **Sync Method** | Webflow Webhooks → SQLite |
| **Hosting** | Webflow Cloud |
| **Content Type** | Podcasts (architecture must support future content types) |

---

## Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| **Primary Green** | `#60977F` | Primary buttons (Spotify), accents, map markers |
| **Accent Yellow** | `#FFE879` | Highlights, hover states, secondary accents |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     WEBFLOW CMS                             │
│                  (Source of Truth)                          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ Webhooks fire on:
                  │ • collection_item_created
                  │ • collection_item_changed
                  │ • collection_item_deleted
                  │ • collection_item_unpublished
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              WEBFLOW CLOUD (Your App)                       │
│  ┌────────────────────┐    ┌─────────────────────────────┐  │
│  │  Webhook Endpoint  │───▶│  SQLite Database            │  │
│  │  /api/sync         │    │  • podcasts table           │  │
│  └────────────────────┘    │  • tags table               │  │
│                            │  • podcast_tags table       │  │
│                            └──────────────┬──────────────┘  │
│                                           │                 │
│  ┌────────────────────────────────────────▼──────────────┐  │
│  │              Good Place Map App                       │  │
│  │         Queries SQLite directly (fast!)               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Why This Architecture?

| Approach | Speed | Scalability | Complexity |
|----------|-------|-------------|------------|
| Direct Webflow API calls | Slow (200-500ms) | Poor (rate limits) | Low |
| SQLite with webhook sync | Fast (10-50ms) | Excellent | Medium |

The SQLite approach enables:
- Fast map loading (no API calls on page load)
- Efficient tag filtering at database level
- Real-time updates via webhooks
- Scalability to hundreds of episodes

---

## Data Architecture

### Webflow CMS Collection: Podcasts

Each podcast entry in Webflow CMS should have these fields:

| Field Name | Field Type | Description |
|------------|------------|-------------|
| `name` | Plain Text | Episode title (required) |
| `slug` | Slug | URL-friendly identifier |
| `description` | Rich Text | Episode description |
| `thumbnail` | Image | Episode thumbnail/artwork |
| `youtube-link` | URL | Full YouTube video URL |
| `spotify-link` | URL | Spotify episode URL |
| `tags` | Multi-reference or Option | Episode tags (e.g., "Volunteering", "Help", "Belong") |
| `latitude` | Number | Location coordinate |
| `longitude` | Number | Location coordinate |
| `location-name` | Plain Text | Human-readable location name (optional) |
| `published-date` | Date | Release date for sorting |

### SQLite Database Schema

```sql
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
  published_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tags table
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
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

-- Index for faster tag filtering
CREATE INDEX idx_podcast_tags_tag_id ON podcast_tags(tag_id);
CREATE INDEX idx_podcasts_coordinates ON podcasts(latitude, longitude);
```

### Drizzle ORM Schema (if using Drizzle)

```typescript
// src/db/schema.ts
import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

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
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).defaultNow(),
});

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug'),
});

export const podcastTags = sqliteTable('podcast_tags', {
  podcastId: text('podcast_id').notNull().references(() => podcasts.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.podcastId, table.tagId] }),
}));
```

---

## Webhook Sync Implementation

### Webflow Cloud Configuration

Add SQLite binding to `wrangler.json`:

```json
{
  "name": "good-place",
  "compatibility_date": "2024-01-01",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "good-place-db",
      "database_id": "<will-be-generated>",
      "migrations_dir": "migrations"
    }
  ]
}
```

### Webhook Endpoint

```typescript
// src/app/api/webhooks/cms-sync/route.ts
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import crypto from "crypto";

// Verify Webflow webhook signature
function verifySignature(
  timestamp: string,
  body: string,
  signature: string,
  secret: string
): boolean {
  const data = `${timestamp}:${body}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("hex");
  
  // Check if request is older than 5 minutes
  const requestTime = parseInt(timestamp, 10);
  if (Date.now() - requestTime > 300000) {
    return false;
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSignature, "hex")
  );
}

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  
  // Get headers
  const timestamp = request.headers.get("x-webflow-timestamp");
  const signature = request.headers.get("x-webflow-signature");
  
  if (!timestamp || !signature) {
    return new Response("Missing signature headers", { status: 401 });
  }
  
  // Get body
  const bodyText = await request.text();
  
  // Verify signature
  const isValid = verifySignature(
    timestamp,
    bodyText,
    signature,
    env.WEBFLOW_WEBHOOK_SECRET
  );
  
  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }
  
  const { triggerType, payload } = JSON.parse(bodyText);
  const db = drizzle(env.DB, { schema });
  
  try {
    switch (triggerType) {
      case "collection_item_created":
      case "collection_item_changed":
        await upsertPodcast(db, payload);
        break;
      case "collection_item_deleted":
      case "collection_item_unpublished":
        await deletePodcast(db, payload.itemId);
        break;
      default:
        console.log(`Unhandled trigger type: ${triggerType}`);
    }
    
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response("Internal error", { status: 500 });
  }
}

async function upsertPodcast(db: any, payload: any) {
  const fieldData = payload.fieldData;
  
  // Upsert podcast
  await db
    .insert(schema.podcasts)
    .values({
      id: crypto.randomUUID(),
      webflowItemId: payload.id,
      title: fieldData.name,
      slug: fieldData.slug,
      description: fieldData.description,
      thumbnailUrl: fieldData.thumbnail?.url,
      youtubeLink: fieldData["youtube-link"],
      spotifyLink: fieldData["spotify-link"],
      latitude: parseFloat(fieldData.latitude),
      longitude: parseFloat(fieldData.longitude),
      locationName: fieldData["location-name"],
      publishedAt: fieldData["published-date"] 
        ? new Date(fieldData["published-date"]) 
        : null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.podcasts.webflowItemId,
      set: {
        title: fieldData.name,
        slug: fieldData.slug,
        description: fieldData.description,
        thumbnailUrl: fieldData.thumbnail?.url,
        youtubeLink: fieldData["youtube-link"],
        spotifyLink: fieldData["spotify-link"],
        latitude: parseFloat(fieldData.latitude),
        longitude: parseFloat(fieldData.longitude),
        locationName: fieldData["location-name"],
        publishedAt: fieldData["published-date"] 
          ? new Date(fieldData["published-date"]) 
          : null,
        updatedAt: new Date(),
      },
    });
  
  // Handle tags (if using multi-reference)
  // This depends on your Webflow CMS structure
  if (fieldData.tags && Array.isArray(fieldData.tags)) {
    await syncPodcastTags(db, payload.id, fieldData.tags);
  }
}

async function deletePodcast(db: any, webflowItemId: string) {
  await db
    .delete(schema.podcasts)
    .where(eq(schema.podcasts.webflowItemId, webflowItemId));
}

async function syncPodcastTags(db: any, podcastWebflowId: string, tagIds: string[]) {
  // Get podcast ID from webflow ID
  const podcast = await db
    .select({ id: schema.podcasts.id })
    .from(schema.podcasts)
    .where(eq(schema.podcasts.webflowItemId, podcastWebflowId))
    .get();
  
  if (!podcast) return;
  
  // Delete existing tags
  await db
    .delete(schema.podcastTags)
    .where(eq(schema.podcastTags.podcastId, podcast.id));
  
  // Insert new tags
  for (const tagId of tagIds) {
    await db.insert(schema.podcastTags).values({
      podcastId: podcast.id,
      tagId: tagId,
    });
  }
}
```

### Initial Data Sync Script

Create a script for initial full sync from Webflow CMS:

```typescript
// scripts/initial-sync.ts
import { WebflowClient } from "webflow-api";

async function initialSync() {
  const webflow = new WebflowClient({ accessToken: process.env.WEBFLOW_API_TOKEN });
  
  // Fetch all podcasts from Webflow CMS
  const items = await webflow.collections.items.listItems(
    process.env.WEBFLOW_PODCASTS_COLLECTION_ID!,
    { limit: 100 }
  );
  
  // Process and insert into SQLite
  for (const item of items.items || []) {
    // Insert logic here (similar to upsertPodcast)
  }
  
  console.log(`Synced ${items.items?.length} podcasts`);
}

initialSync();
```

### Setting Up Webhooks

Register webhooks via Webflow API or dashboard:

```typescript
// One-time setup script
const webhookEvents = [
  "collection_item_created",
  "collection_item_changed", 
  "collection_item_deleted",
  "collection_item_unpublished",
];

for (const triggerType of webhookEvents) {
  await webflow.webhooks.create(siteId, {
    triggerType,
    url: "https://your-app.webflow.io/api/webhooks/cms-sync",
    filter: {
      collectionId: PODCASTS_COLLECTION_ID,
    },
  });
}
```

---

## Core Features

### 1. Map Display

**Initial Load:**
- Automatically fit map bounds to contain all podcast pins in view
- Calculate bounds from all podcast coordinates
- Apply padding to ensure pins aren't at the very edge

```typescript
// Calculate bounds to fit all pins
function calculateBounds(podcasts: Podcast[]): LatLngBounds {
  const coordinates = podcasts.map(p => [p.latitude, p.longitude]);
  return L.latLngBounds(coordinates);
}

// On map init
map.fitBounds(calculateBounds(podcasts), { padding: [50, 50] });
```

**Map Settings:**
- Use OpenStreetMap tiles
- Responsive design for desktop and mobile
- Custom marker icons (branded green markers)

### 2. Marker System

**Individual Markers:**
- Custom "G" branded pin icons in primary green (`#60977F`)
- Visually distinct and easily tappable on mobile
- Show location dot/indicator

**Clustering:**
- Group nearby pins into clusters when zoomed out
- Display count of grouped items on cluster marker
- Clicking cluster zooms to reveal individual pins or smaller clusters
- Smooth zoom animation on cluster click
- Use MapCN's clustering or Leaflet.markercluster

```typescript
// Clustering configuration
const clusterOptions = {
  maxClusterRadius: 50,
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  zoomToBoundsOnClick: true,
  animate: true,
};
```

### 3. Popup Card Behavior

**Positioning:**
- Card is centered horizontally and vertically in the viewport
- The selected pin sits **below** the card (not obscured)
- Map pans to position pin visible beneath the centered card

```typescript
// Calculate pan offset so pin appears below card
function calculatePanOffset(cardHeight: number, viewportHeight: number): number {
  const cardCenter = viewportHeight / 2;
  const pinPosition = cardCenter + (cardHeight / 2) + 20; // 20px gap
  return pinPosition - cardCenter;
}

// Pan map when opening card
function openCard(podcast: Podcast) {
  const offset = calculatePanOffset(CARD_HEIGHT, window.innerHeight);
  map.panTo([podcast.latitude, podcast.longitude], {
    animate: true,
  });
  // Adjust for card overlay
  map.panBy([0, -offset]);
}
```

**Opening:**
- Triggered by clicking/tapping a map pin
- Map pans to position the selected pin below the centered card
- Map becomes locked (pan/zoom disabled) while card is open

**Closing:**
- Close button (X icon) in top-right corner of card
- Clicking/tapping outside the card on the map
- After closing, map unlocks for normal interaction

**Dimensions:**
- Maximum width: ~450px
- Maximum height: ~80vh (viewport relative)
- Responsive sizing for mobile
- Rounded corners (border-radius: 12px)
- Subtle shadow for elevation

### 4. Popup Card Content

**Layout (top to bottom):**

```
┌─────────────────────────────────────┐
│  [Thumbnail Image]            [X]   │  ← Close button overlays thumbnail
│                                     │
├─────────────────────────────────────┤
│  Episode Title                      │
│                                     │
│  [TAG 1] [TAG 2] [TAG 3] [TAG 4]   │  ← Tag pills
│                                     │
│  Description text that can be       │
│  quite long and will be truncated   │
│  after a few lines...Show more      │  ← Collapsible
│                                     │
│  ┌─────────────────────────────┐   │
│  │     Listen on Spotify       │   │  ← Green button (#60977F)
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │     Watch on YouTube        │   │  ← Dark/red button
│  └─────────────────────────────┘   │
│                                     │
│  ← Back to list                     │  ← Only if opened from list
└─────────────────────────────────────┘
```

**Thumbnail:**
- Full-width image at top of card
- Aspect ratio maintained
- Close button positioned top-right, overlaying the thumbnail
- Close button has semi-transparent background for visibility

**Title:**
- Bold text, prominent size
- Dark text color

**Tags:**
- Horizontal row of pill/badge components
- Uppercase text
- Light background with subtle border
- Pulled from Webflow CMS tags field
- Wrap to second line if many tags

```typescript
// Tag pill component
<span className="tag-pill">
  {tag.name.toUpperCase()}
</span>

// Styles
.tag-pill {
  display: inline-block;
  padding: 4px 10px;
  background: #f0f0f0;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  margin-right: 6px;
  margin-bottom: 6px;
}
```

**Description:**
- Truncated by default (3 lines with ellipsis)
- "...Show more" link at end of truncated text
- On expand:
  - Full description shown
  - Internal scrollbar if content exceeds available space
  - Card height does not exceed viewport
  - Link changes to "Show less"

```typescript
// Collapsible description state
const [isExpanded, setIsExpanded] = useState(false);
const maxCollapsedHeight = 72; // ~3 lines

<div 
  className="description-container"
  style={{ 
    maxHeight: isExpanded ? '200px' : `${maxCollapsedHeight}px`,
    overflowY: isExpanded ? 'auto' : 'hidden'
  }}
>
  {description}
</div>
<button onClick={() => setIsExpanded(!isExpanded)}>
  {isExpanded ? 'Show less' : '...Show more'}
</button>
```

**Action Buttons:**
- "Listen on Spotify" - Primary green button (`#60977F`), full width
- "Watch on YouTube" - Dark/secondary button, full width
- Both open in new tab
- Stack vertically with small gap

**Back to List Button:**
- Only shown when card was opened from list view
- Text link or subtle button: "← Back to list"
- Returns user to list view at previous scroll position

### 5. List View Modal

**Appearance:**
- Slides in as a modal/panel **overlaying** the map
- Map remains visible in background (dimmed)
- White/light background
- Positioned on left side (desktop) or slides up from bottom (mobile)
- Takes approximately 400-500px width (desktop) or full width (mobile)
- "LIST VIEW" header at top in caps

```
┌──────────────────────┬─────────────────────────────────┐
│  LIST VIEW           │                                 │
│  ─────────────────   │                                 │
│  Filter: [All Tags ▼]│         MAP (dimmed)            │
│  ─────────────────   │                                 │
│  ┌────────────────┐  │                                 │
│  │ 🖼 │ Title...  │  │                                 │
│  │    │ Desc...   │  │                                 │
│  │    │ [TAGS]    │  │                                 │
│  └────────────────┘  │                                 │
│  ┌────────────────┐  │                                 │
│  │ 🖼 │ Title...  │  │                                 │
│  │    │ Desc...   │  │                                 │
│  │    │ [TAGS]    │  │                                 │
│  └────────────────┘  │                                 │
│  ...                 │                                 │
└──────────────────────┴─────────────────────────────────┘
```

**Toggle:**
- Button/icon to open list view (positioned on map)
- Close button in list view header
- Smooth slide animation (300ms ease)
- Map interaction disabled while modal is open
- Clicking dimmed map area also closes modal

**List Item Display:**
Each list item shows:
- Thumbnail image (left side, square, ~80px)
- Title (truncated with "..." if too long)
- Description preview (1-2 lines, truncated)
- Tags as small pills below description

```typescript
// List item component
<div className="list-item" onClick={() => handleItemClick(podcast)}>
  <img src={podcast.thumbnailUrl} alt="" className="list-thumbnail" />
  <div className="list-content">
    <h3 className="list-title">{podcast.title}</h3>
    <p className="list-description">{truncate(podcast.description, 100)}</p>
    <div className="list-tags">
      {podcast.tags.map(tag => (
        <span key={tag.id} className="tag-pill-small">{tag.name}</span>
      ))}
    </div>
  </div>
</div>
```

**Filter Functionality:**
- Dropdown or multi-select at top of list view
- Filter episodes by one or more tags
- "All" option to show everything
- Clear filters button/option
- Filtered results update immediately
- Show count: "Showing X of Y episodes"

```typescript
// Filter state
const [activeFilters, setActiveFilters] = useState<string[]>([]);

// Filter logic (done at database level for performance)
const filteredPodcasts = useMemo(() => {
  if (activeFilters.length === 0) return podcasts;
  return podcasts.filter(p => 
    p.tags.some(tag => activeFilters.includes(tag.id))
  );
}, [podcasts, activeFilters]);
```

**Sorting:**
- Default: newest first (by published date)
- Future: alphabetical option

**List-to-Map Interaction:**
When clicking a list item:
1. Close the list view modal (with animation)
2. Pan/zoom map to the episode location
3. Open the episode popup card
4. Card includes "Back to list" button

"Back to list" button behavior:
- Returns user to list view modal
- Restores previous scroll position
- Maintains any active tag filters

```typescript
// State for list navigation
const [openedFromList, setOpenedFromList] = useState(false);
const [listScrollPosition, setListScrollPosition] = useState(0);

function handleListItemClick(podcast: Podcast) {
  // Save state
  setListScrollPosition(listRef.current?.scrollTop || 0);
  setOpenedFromList(true);
  
  // Close list and open card
  setIsListOpen(false);
  setSelectedPodcast(podcast);
  
  // Pan map to location
  map.flyTo([podcast.latitude, podcast.longitude], 15);
}

function handleBackToList() {
  setSelectedPodcast(null);
  setIsListOpen(true);
  
  // Restore scroll position
  requestAnimationFrame(() => {
    listRef.current?.scrollTo(0, listScrollPosition);
  });
}
```

---

## Component Structure

```
/src
├── app/
│   ├── page.tsx                       # Main map page
│   ├── layout.tsx                     # Root layout
│   └── api/
│       ├── podcasts/
│       │   └── route.ts               # GET podcasts from SQLite
│       └── webhooks/
│           └── cms-sync/
│               └── route.ts           # Webhook handler
├── components/
│   ├── Map/
│   │   ├── MapContainer.tsx           # Main map wrapper with Leaflet/MapCN
│   │   ├── MapControls.tsx            # Zoom buttons, list view toggle
│   │   ├── MarkerCluster.tsx          # Clustering logic
│   │   └── PodcastMarker.tsx          # Individual marker component
│   ├── Card/
│   │   ├── PopupCard.tsx              # Main card container
│   │   ├── CardThumbnail.tsx          # Thumbnail with close button overlay
│   │   ├── TagList.tsx                # Horizontal tag pills
│   │   ├── CollapsibleDescription.tsx # Show more/less description
│   │   └── ActionButtons.tsx          # Spotify + YouTube buttons
│   ├── ListView/
│   │   ├── ListViewModal.tsx          # Modal container with overlay
│   │   ├── ListHeader.tsx             # Title + close button
│   │   ├── TagFilter.tsx              # Filter dropdown/selector
│   │   └── ListItem.tsx               # Individual list entry
│   └── UI/
│       ├── TagPill.tsx                # Reusable tag badge component
│       ├── CloseButton.tsx            # Reusable close button
│       ├── Button.tsx                 # Styled button component
│       └── Overlay.tsx                # Dimmed background overlay
├── db/
│   ├── index.ts                       # Database connection helper
│   └── schema.ts                      # Drizzle schema definitions
├── hooks/
│   ├── usePodcasts.ts                 # Fetch and cache podcasts
│   ├── useMapState.ts                 # Map position, zoom, lock state
│   ├── useCardState.ts                # Selected podcast, card open state
│   ├── useListView.ts                 # List modal state, filters, scroll
│   └── useTags.ts                     # Available tags for filtering
├── lib/
│   ├── webflow.ts                     # Webflow API client helpers
│   └── utils.ts                       # General utilities
├── types/
│   └── index.ts                       # TypeScript interfaces
└── styles/
    ├── globals.css                    # Global styles
    └── variables.css                  # CSS custom properties (colors, etc.)
```

---

## State Management

### TypeScript Interfaces

```typescript
// src/types/index.ts

export interface Podcast {
  id: string;
  webflowItemId: string;
  title: string;
  slug: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  youtubeLink: string | null;
  spotifyLink: string | null;
  latitude: number;
  longitude: number;
  locationName: string | null;
  publishedAt: Date | null;
  tags: Tag[];
}

export interface Tag {
  id: string;
  name: string;
  slug: string | null;
}

export interface MapState {
  center: [number, number];
  zoom: number;
  bounds: LatLngBounds | null;
  isLocked: boolean;
}

export interface CardState {
  selectedPodcast: Podcast | null;
  isOpen: boolean;
  openedFromList: boolean;
  isDescriptionExpanded: boolean;
}

export interface ListViewState {
  isOpen: boolean;
  scrollPosition: number;
  activeTagFilters: string[];
}

export interface AppState {
  // Data
  podcasts: Podcast[];
  tags: Tag[];
  isLoading: boolean;
  error: string | null;
  
  // Map
  map: MapState;
  
  // Card
  card: CardState;
  
  // List View
  listView: ListViewState;
}
```

### State Hooks

```typescript
// src/hooks/useAppState.ts
import { create } from 'zustand';

export const useAppStore = create<AppState & Actions>((set, get) => ({
  // Initial state
  podcasts: [],
  tags: [],
  isLoading: true,
  error: null,
  
  map: {
    center: [52.07, 4.30], // Default: The Hague area
    zoom: 12,
    bounds: null,
    isLocked: false,
  },
  
  card: {
    selectedPodcast: null,
    isOpen: false,
    openedFromList: false,
    isDescriptionExpanded: false,
  },
  
  listView: {
    isOpen: false,
    scrollPosition: 0,
    activeTagFilters: [],
  },
  
  // Actions
  setPodcasts: (podcasts) => set({ podcasts, isLoading: false }),
  setError: (error) => set({ error, isLoading: false }),
  
  openCard: (podcast, fromList = false) => set({
    card: {
      selectedPodcast: podcast,
      isOpen: true,
      openedFromList: fromList,
      isDescriptionExpanded: false,
    },
    map: { ...get().map, isLocked: true },
  }),
  
  closeCard: () => set({
    card: {
      selectedPodcast: null,
      isOpen: false,
      openedFromList: false,
      isDescriptionExpanded: false,
    },
    map: { ...get().map, isLocked: false },
  }),
  
  toggleListView: () => set((state) => ({
    listView: { ...state.listView, isOpen: !state.listView.isOpen },
  })),
  
  setTagFilters: (filters) => set((state) => ({
    listView: { ...state.listView, activeTagFilters: filters },
  })),
  
  saveListScrollPosition: (position) => set((state) => ({
    listView: { ...state.listView, scrollPosition: position },
  })),
}));
```

---

## API Routes

### GET /api/podcasts

Fetch all podcasts with their tags:

```typescript
// src/app/api/podcasts/route.ts
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const db = drizzle(env.DB, { schema });
  
  // Get URL params for filtering
  const { searchParams } = new URL(request.url);
  const tagIds = searchParams.get('tags')?.split(',').filter(Boolean) || [];
  
  // Base query
  let query = db
    .select()
    .from(schema.podcasts)
    .orderBy(desc(schema.podcasts.publishedAt));
  
  // Apply tag filter if specified
  if (tagIds.length > 0) {
    query = query
      .innerJoin(
        schema.podcastTags,
        eq(schema.podcasts.id, schema.podcastTags.podcastId)
      )
      .where(inArray(schema.podcastTags.tagId, tagIds));
  }
  
  const podcasts = await query;
  
  // Fetch tags for each podcast
  const podcastsWithTags = await Promise.all(
    podcasts.map(async (podcast) => {
      const tags = await db
        .select({ id: schema.tags.id, name: schema.tags.name })
        .from(schema.tags)
        .innerJoin(
          schema.podcastTags,
          eq(schema.tags.id, schema.podcastTags.tagId)
        )
        .where(eq(schema.podcastTags.podcastId, podcast.id));
      
      return { ...podcast, tags };
    })
  );
  
  return Response.json(podcastsWithTags);
}
```

### GET /api/tags

Fetch all available tags:

```typescript
// src/app/api/tags/route.ts
export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  const db = drizzle(env.DB, { schema });
  
  const tags = await db.select().from(schema.tags).orderBy(schema.tags.name);
  
  return Response.json(tags);
}
```

---

## MapCN Integration Notes

MapCN is built on top of Leaflet/React-Leaflet. Before implementation, verify:

1. **Clustering support** - Check if MapCN has built-in clustering or if you need to add react-leaflet-markercluster
2. **Custom markers** - Confirm custom marker icons work as expected
3. **Programmatic controls** - Ensure you can programmatically pan, zoom, and lock the map
4. **Bounds fitting** - Verify fitBounds works for initial load

If MapCN doesn't support all features, fall back to react-leaflet directly:

```typescript
// Fallback: Direct react-leaflet usage
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import 'react-leaflet-markercluster/dist/styles.min.css';

function Map({ podcasts }: { podcasts: Podcast[] }) {
  return (
    <MapContainer
      center={[52.07, 4.30]}
      zoom={12}
      className="h-screen w-screen"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      <MarkerClusterGroup>
        {podcasts.map(podcast => (
          <Marker
            key={podcast.id}
            position={[podcast.latitude, podcast.longitude]}
            icon={customIcon}
            eventHandlers={{
              click: () => handleMarkerClick(podcast),
            }}
          />
        ))}
      </MarkerClusterGroup>
      <MapController /> {/* For programmatic control */}
    </MapContainer>
  );
}
```

---

## Environment Variables

Required environment variables for Webflow Cloud:

```bash
# Webflow API (for initial sync script)
WEBFLOW_API_TOKEN=your_webflow_api_token
WEBFLOW_SITE_ID=your_site_id
WEBFLOW_PODCASTS_COLLECTION_ID=your_collection_id

# Webhook verification
WEBFLOW_WEBHOOK_SECRET=your_webhook_secret

# SQLite is configured via wrangler.json bindings, not env vars
```

---

## Deployment Checklist

### Initial Setup

1. [ ] Create Webflow Cloud project
2. [ ] Configure SQLite binding in `wrangler.json`
3. [ ] Run database migrations
4. [ ] Set environment variables
5. [ ] Run initial sync script to populate database
6. [ ] Register webhooks with Webflow API
7. [ ] Deploy to Webflow Cloud

### Webhook Registration

After deployment, register webhooks:

```bash
# Use Webflow API or dashboard to create webhooks for:
# - collection_item_created
# - collection_item_changed  
# - collection_item_deleted
# - collection_item_unpublished

# Filter to only your podcasts collection
```

### Testing

- [ ] Verify initial data loads from SQLite
- [ ] Test webhook by creating/updating a podcast in Webflow CMS
- [ ] Confirm real-time sync works
- [ ] Test all UI interactions

---

## Testing Checklist

### Data & Sync
- [ ] Initial sync populates SQLite correctly
- [ ] Webhooks receive and process events
- [ ] New podcasts appear on map after CMS publish
- [ ] Updated podcasts reflect changes
- [ ] Deleted podcasts are removed

### Map
- [ ] Initial load fits all pins in viewport
- [ ] Custom markers display correctly
- [ ] Clustering works at various zoom levels
- [ ] Cluster click zooms to reveal pins
- [ ] Map locks when card is open
- [ ] Map unlocks when card closes

### Popup Card
- [ ] Card centers in viewport
- [ ] Pin visible below card
- [ ] Thumbnail displays correctly
- [ ] Title renders properly
- [ ] Tags display as pills
- [ ] Description truncates with "Show more"
- [ ] Description expands with scrollbar
- [ ] Spotify button opens correct link
- [ ] YouTube button opens correct link
- [ ] Close button works
- [ ] Click outside closes card
- [ ] "Back to list" appears when opened from list
- [ ] "Back to list" returns to correct position

### List View
- [ ] Modal opens with animation
- [ ] Map dimmed behind modal
- [ ] All podcasts listed
- [ ] List items show thumbnail, title, description, tags
- [ ] Tag filter dropdown works
- [ ] Multiple tag selection works
- [ ] Filter results update immediately
- [ ] Clear filter option works
- [ ] Click item closes modal and opens card
- [ ] Scroll position preserved on return

### Responsive
- [ ] Desktop layout works
- [ ] Mobile layout works
- [ ] Touch interactions work
- [ ] Card sizes appropriately on mobile
- [ ] List view full-screen on mobile

### Performance
- [ ] Map loads quickly (< 1 second)
- [ ] 65+ markers don't cause lag
- [ ] Clustering performs smoothly
- [ ] Card animations are smooth

---

## Future Considerations

### Additional Content Types

The architecture supports adding more content types:

1. Create new Webflow CMS collection
2. Add corresponding SQLite table
3. Register webhooks for new collection
4. Add new marker style/icon
5. Update filter UI to include content type toggle

### Potential Enhancements

- Search functionality in list view
- Location-based sorting ("nearest to me")
- Favorites/bookmarks (requires user accounts)
- Share episode links
- Episode playback directly in card
- Map style customization (dark mode, etc.)

---

## Troubleshooting

### Webhook not firing
- Verify site is published
- Check webhook is registered correctly
- Confirm collection ID filter is correct

### Data not syncing
- Check Webflow Cloud logs for webhook errors
- Verify signature validation is working
- Check SQLite migrations are applied

### Map not loading
- Verify MapCN/Leaflet is installed correctly
- Check for JavaScript errors in console
- Confirm podcasts API returns data

### Card positioning issues
- Check viewport calculations
- Verify map pan offset logic
- Test on multiple screen sizes
