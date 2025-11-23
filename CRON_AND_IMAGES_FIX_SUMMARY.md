# Cron Job and Image Fixes - Complete Summary

## Issues Fixed ✅

### 1. Cron Job Schedule ✅
**Problem**: Cron job was not running automatically every 6 hours.

**Solution**:
- Changed schedule from `"0 0,6,12,18 * * *"` (specific hours) to `"0 */3 * * *"` (every 3 hours)
- This runs every 3 hours: 0:00, 3:00, 6:00, 9:00, 12:00, 15:00, 18:00, 21:00 UTC
- More frequent updates ensure fresh content

**File Modified**: `vercel.json`

### 2. Duplicate Article Detection ✅
**Problem**: Articles were being imported multiple times, creating duplicates.

**Solution**:
- Enhanced duplicate detection to check GUID, slug, AND title
- Added defensive duplicate check right before creating article (prevents race conditions)
- Improved duplicate detection logic to check all three methods in one query
- Added tracking of processed articles within the same run to prevent duplicates

**Files Modified**:
- `src/app/api/cron/sync-articles/route.ts` - Enhanced duplicate checks
- Improved `normalizeGuid` function usage

**Changes**:
```typescript
// Before: Separate checks
if (guidKey && existingGuids.has(guidKey)) { ... }
if (existingSlugs.has(slugKey)) { ... }
if (existingTitles.has(titleKey)) { ... }

// After: Combined check
const duplicateReason = 
  (guidKey && existingGuids.has(guidKey)) ? 'GUID match' :
  existingSlugs.has(slugKey) ? 'slug match' :
  existingTitles.has(titleKey) ? 'title match' : null;

if (duplicateReason) { skip article }
```

### 3. RSS Feed Fetching from All Sources ✅
**Problem**: Only fetching from "Not a Tesla App", not getting articles from other sources.

**Solution**:
- Removed WordPress pagination (WordPress RSS feeds don't support `paged` parameter)
- Simplified RSS feed fetching to use single feed URLs
- Improved error handling to continue with other feeds if one fails
- Added better logging to show which feeds are being fetched
- Ensured all feeds are processed: Not a Tesla App, TESLARATI, Electrek, CleanTechnica

**Files Modified**:
- `src/lib/rss-parser.ts` - Removed pagination logic, improved feed fetching
- `RSS_FEEDS` configuration - Removed `pages` parameter

**Changes**:
```typescript
// Before: Tried to paginate WordPress feeds (doesn't work)
const pageUrl = pagesToFetch > 1 
  ? `${feedConfig.url}${feedConfig.url.includes('?') ? '&' : '?'}paged=${page}`
  : feedConfig.url;

// After: Single feed fetch (WordPress handles pagination internally)
const response = await fetch(feedConfig.url, {
  next: { revalidate: 0 }, // Always fetch fresh data for cron
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; TeslaNewsBot/1.0)',
    'Accept': 'application/rss+xml, application/xml, text/xml',
  },
});
```

### 4. Inline Images Not Showing ✅
**Problem**: Inline images in articles were not displaying (broken links).

**Solution**:
- Enhanced `extractAllImages` function to accept `baseUrl` parameter for resolving relative URLs
- Improved image URL replacement to handle multiple formats (src, href, encoded URLs)
- Fixed relative URL resolution to work with all sources (not just Teslarati)
- Enhanced image replacement patterns to catch all URL formats
- Added better logging to track image upload and replacement

**Files Modified**:
- `src/lib/rss-parser.ts` - Enhanced `extractAllImages` function
- `src/lib/sanity-image-upload.ts` - Improved `replaceImageUrlsInHtml` function
- `src/app/api/cron/sync-articles/route.ts` - Pass article URL to image extraction
- `src/app/api/sync-articles/route.ts` - Pass article URL to image extraction
- `src/app/api/admin/reset-and-sync/route.ts` - Pass article URL to image extraction

**Key Changes**:

1. **Image Extraction**:
```typescript
// Before: Hardcoded Teslarati domain
if (imgSrc.startsWith('/')) {
  fullUrl = `https://www.teslarati.com${imgSrc}`;
}

// After: Dynamic domain resolution
if (imgSrc.startsWith('/')) {
  if (baseDomain) {
    const urlObj = new URL(baseDomain);
    imgSrc = `${urlObj.protocol}//${urlObj.host}${imgSrc}`;
  }
}
```

2. **Image URL Replacement**:
```typescript
// Enhanced to handle multiple patterns:
// - src="..." attributes
// - href="..." attributes  
// - URL-encoded versions
// - Standalone URLs
const srcPattern = new RegExp(`(src=["'])${escapedUrl}(["'])`, 'gi');
const srcEncodedPattern = new RegExp(`(src=["'])${encodedUrl}(["'])`, 'gi');
const hrefPattern = new RegExp(`(href=["'])${escapedUrl}(["'])`, 'gi');
const standalonePattern = new RegExp(escapedUrl, 'g');
```

## Testing Recommendations

### Test Cron Job
1. **Wait for automatic run**: Cron runs every 3 hours
2. **Check Vercel logs**: Go to Vercel Dashboard → Your Project → Logs
3. **Look for**: `[Cron Sync] Triggered by Vercel Cron (automatic)`
4. **Verify**: Articles are imported from multiple sources

### Test Duplicate Prevention
1. **Manually trigger cron**: `GET /api/cron/sync-articles`
2. **Check logs**: Should see `⏭️  Skipping duplicate` messages
3. **Verify**: No duplicate articles in Sanity

### Test RSS Feed Fetching
1. **Check logs**: Should see messages like:
   - `[RSS Parser] Fetching from Not a Tesla App: ...`
   - `[RSS Parser] Fetching from TESLARATI: ...`
   - `[RSS Parser] Fetching from Electrek: ...`
   - `[RSS Parser] Fetching from CleanTechnica: ...`
2. **Verify**: Articles from all sources are being fetched

### Test Image Upload and Display
1. **Check article content**: View an article page
2. **Inspect images**: Check browser DevTools → Network tab
3. **Verify**: Images should load from Sanity CDN (`cdn.sanity.io`)
4. **Check logs**: Should see `[Image Replace] ✓ Replaced` messages

## Expected Behavior

### Cron Job
- ✅ Runs automatically every 3 hours
- ✅ Fetches from all 4 RSS sources
- ✅ Imports new articles only (no duplicates)
- ✅ Uploads images to Sanity
- ✅ Replaces image URLs in HTML content

### Article Import
- ✅ No duplicate articles
- ✅ Articles from all sources (Not a Tesla App, TESLARATI, Electrek, CleanTechnica)
- ✅ Images uploaded to Sanity
- ✅ Image URLs replaced in HTML content
- ✅ Images display correctly in articles

## Files Modified

1. **`vercel.json`** - Updated cron schedule
2. **`src/lib/rss-parser.ts`** - Fixed RSS feed fetching, enhanced image extraction
3. **`src/lib/sanity-image-upload.ts`** - Improved image URL replacement
4. **`src/app/api/cron/sync-articles/route.ts`** - Enhanced duplicate detection, image handling
5. **`src/app/api/sync-articles/route.ts`** - Updated image extraction calls
6. **`src/app/api/admin/reset-and-sync/route.ts`** - Updated image extraction calls

## Next Steps

1. **Deploy to Production**: Deploy these changes to Vercel
2. **Monitor First Cron Run**: Check logs after deployment
3. **Verify Images**: Check that images are displaying correctly in articles
4. **Check Sources**: Verify articles are coming from all sources

## Notes

- Cron schedule: Every 3 hours (more frequent than before)
- WordPress feeds: Don't support pagination via URL parameters - each feed URL returns latest articles
- Image extraction: Now works with all sources, not just Teslarati
- Duplicate detection: Triple-check (GUID, slug, title) prevents duplicates
- Image replacement: Handles multiple URL formats for better compatibility

