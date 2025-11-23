# Multi-RSS Feed Support

## Overview
The system now supports multiple RSS feeds from different sources. Articles are fetched from all configured feeds, deduplicated, and imported with the correct source attribution.

## Configured RSS Feeds

### 1. Not a Tesla App
- **URL**: `https://www.notateslaapp.com/rss`
- **Source Name**: `Not a Tesla App`

### 2. TESLARATI - Tesla Category
- **URL**: `https://www.teslarati.com/category/tesla/feed/`
- **Source Name**: `TESLARATI`

### 3. TESLARATI - Model 3 Category
- **URL**: `https://www.teslarati.com/category/model-3/feed/`
- **Source Name**: `TESLARATI`

### 4. TESLARATI - Model Y Category
- **URL**: `https://www.teslarati.com/category/model-y/feed/`
- **Source Name**: `TESLARATI`

## How It Works

### RSS Feed Processing
1. **Fetch All Feeds**: The system fetches articles from all configured RSS feeds in parallel
2. **Parse Articles**: Each feed is parsed using the same rules:
   - Extracts title, link, description, published date
   - Extracts images from `media:content`, `content:encoded`, or `enclosure` tags
   - Handles Teslarati's `content:encoded` format for full article content
3. **Deduplication**: Articles are deduplicated by URL (same article appearing in multiple feeds is only imported once)
4. **Source Attribution**: Each article retains its source name (`Not a Tesla App` or `TESLARATI`)

### Image Extraction
The parser now supports multiple image extraction methods:
- **Not a Tesla App**: Uses `media:content` tags
- **TESLARATI**: Extracts images from HTML in `content:encoded` tags
- **Fallback**: Uses `enclosure` tags if available

### Content Handling
- **Not a Tesla App**: Uses description field
- **TESLARATI**: Uses `content:encoded` field for full HTML content (more detailed)

## Configuration

RSS feeds are configured in `src/lib/rss-parser.ts`:

```typescript
export const RSS_FEEDS: RSSFeedConfig[] = [
  {
    url: 'https://www.notateslaapp.com/rss',
    sourceName: 'Not a Tesla App',
  },
  {
    url: 'https://www.teslarati.com/category/tesla/feed/',
    sourceName: 'TESLARATI',
  },
  {
    url: 'https://www.teslarati.com/category/model-3/feed/',
    sourceName: 'TESLARATI',
  },
  {
    url: 'https://www.teslarati.com/category/model-y/feed/',
    sourceName: 'TESLARATI',
  },
];
```

## Adding New Feeds

To add a new RSS feed:

1. Add a new entry to `RSS_FEEDS` array in `src/lib/rss-parser.ts`
2. Specify the feed URL and source name
3. The parser will automatically handle the feed using standard RSS 2.0 parsing

Example:
```typescript
{
  url: 'https://example.com/feed/',
  sourceName: 'Example Source',
}
```

## Sync Endpoints

Both sync endpoints (`/api/sync-articles` and `/api/cron/sync-articles`) now:
- Fetch from all configured RSS feeds
- Filter articles to only include those published on or after November 1st, 2025
- Deduplicate articles by URL
- Import articles with correct source attribution
- Use the same translation and publishing workflow

### Processing Limits
- **Cron Sync** (`/api/cron/sync-articles`): Processes up to **20 articles** per run (increased from 10 to accommodate 4 sources)
- **Manual Sync** (`/api/sync-articles`): Processes up to **20 articles** per run

### Date Filtering
- Only articles published on or after **November 1st, 2025** are imported
- Older articles are automatically skipped with logging
- This prevents importing outdated news into the database

## Benefits

1. **More Content**: Articles from multiple sources increase content diversity
2. **Better Coverage**: Different sources cover different aspects of Tesla news
3. **Automatic Deduplication**: Same article from multiple feeds is only imported once
4. **Source Tracking**: Each article retains its original source for attribution
5. **Fault Tolerance**: If one feed fails, others continue to work

## Testing

To test the multi-feed system:

1. **Manual Sync**: `POST /api/sync-articles`
2. **Check Logs**: Look for messages like:
   - `[RSS Parser] Fetching from TESLARATI: https://...`
   - `[RSS Parser] Found X articles from TESLARATI`
   - `[RSS Parser] Total unique articles: X (from Y total)`

## Notes

- Articles are deduplicated by URL, so the same article appearing in multiple feeds will only be imported once
- Source names are preserved in Sanity (`sourceName` field)
- All feeds use the same translation and publishing rules
- Rate limiting delays (500ms) are added between feed fetches to avoid overwhelming servers

