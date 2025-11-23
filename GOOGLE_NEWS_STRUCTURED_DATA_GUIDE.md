# Google News Structured Data Implementation

## ✅ Implementation Complete

Updated the article page component to include proper JSON-LD structured data for Google News with all required Schema.org NewsArticle properties.

## Changes Made

### 1. Updated Sanity Query
- Added `_updatedAt` field to article query in `src/lib/sanity-queries.ts`
- Updated `SanityArticle` interface to include `_updatedAt?: string`

### 2. Updated Article Interface
- Added `updatedAt?: string` to Article interface in `src/app/article/[slug]/page.tsx`
- Mapped `_updatedAt` from Sanity to `updatedAt` in article transformation

### 3. Enhanced Structured Data
Updated JSON-LD script with proper Google News requirements:

#### Required Properties ✅

- **`@type: "NewsArticle"`** ✅
- **`headline`**: Truncated to max 110 characters (Google News requirement)
- **`image`**: Array format with article image URL (fallback to default OG image)
- **`datePublished`**: ISO 8601 format from `publishedAt`
- **`dateModified`**: ISO 8601 format from `updatedAt` (or `publishedAt` if not available)
- **`author`**: Object with `@type: "Person"`, `name`, and `url`
- **`publisher`**: Object with `@type: "Organization"`, `name: "Teslawy"`, and `logo` URL
- **`description`**: Article description or truncated content

## JSON-LD Structure

```json
{
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "headline": "Article Title (max 110 chars)",
  "image": ["https://teslawy.com/article-image.jpg"],
  "datePublished": "2025-01-15T10:30:00.000Z",
  "dateModified": "2025-01-15T12:45:00.000Z",
  "author": {
    "@type": "Person",
    "name": "Source Name",
    "url": "https://teslawy.com/about"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Teslawy",
    "logo": {
      "@type": "ImageObject",
      "url": "https://teslawy.com/textLogo.png",
      "width": 600,
      "height": 60
    }
  },
  "description": "Article description...",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://teslawy.com/article/article-slug"
  },
  "articleSection": "أخبار تسلا",
  "keywords": ["تسلا", "Tesla", "أخبار تسلا", "سيارات كهربائية"],
  "inLanguage": "ar-SA"
}
```

## Implementation Details

### Headline Truncation
```typescript
const headline = article.title.length > 110 
  ? article.title.substring(0, 107) + '...' 
  : article.title;
```
- Ensures headline never exceeds 110 characters
- Adds ellipsis if truncated

### Date Handling
```typescript
const dateModified = article.updatedAt || article.publishedAt;
```
- Uses `_updatedAt` from Sanity if available
- Falls back to `publishedAt` if article hasn't been updated
- Both dates in ISO 8601 format

### Image Handling
```typescript
const imageUrl = article.urlToImage || `${siteUrl}/og-default.jpg`;
```
- Uses article image if available
- Falls back to default OG image
- Always returns array format: `[imageUrl]`

### Author Information
```typescript
const authorName = article.source?.name || 'تسلاوي';
const authorUrl = `${siteUrl}/about`;
```
- Uses source name as author (since articles don't have individual authors)
- Falls back to site name if source not available
- Links to `/about` page (can be updated if you have author pages)

### Publisher Logo
- Uses `/textLogo.png` from public folder
- Includes width and height for proper display
- Can be updated if you have a different logo

## Google News Requirements Met

✅ **Headline**: Max 110 characters  
✅ **Image**: Array format with valid URL  
✅ **datePublished**: ISO 8601 format  
✅ **dateModified**: ISO 8601 format  
✅ **Author**: Person type with name and URL  
✅ **Publisher**: Organization with name and logo  
✅ **Description**: Article summary  

## Testing

### Validate Structured Data

1. **Google Rich Results Test**
   - Visit: https://search.google.com/test/rich-results
   - Enter your article URL
   - Check for NewsArticle validation

2. **Schema.org Validator**
   - Visit: https://validator.schema.org/
   - Paste your article URL or JSON-LD code
   - Verify NewsArticle structure

3. **Browser Inspection**
   - View page source
   - Look for `<script type="application/ld+json">`
   - Verify JSON is valid and properly formatted

### Test Locally
```bash
# Start dev server
npm run dev

# Visit an article page
http://localhost:3000/article/article-slug

# View page source and check JSON-LD script tag
```

## Files Modified

1. **`src/lib/sanity-queries.ts`**
   - Added `_updatedAt` to query
   - Updated `SanityArticle` interface

2. **`src/app/article/[slug]/page.tsx`**
   - Added `updatedAt` to Article interface
   - Updated article transformation to include `updatedAt`
   - Completely rewrote structured data JSON-LD
   - Added proper truncation and formatting

## Next Steps

1. **Deploy to Production**
   - Deploy changes to production
   - Test structured data on live articles

2. **Monitor in Google Search Console**
   - Check for structured data errors
   - Monitor article indexing
   - Verify rich results appear

3. **Optional Enhancements**
   - Create author pages if you want individual author URLs
   - Update logo URL if you have a different logo
   - Add more keywords if needed
   - Consider adding `articleBody` property for full content

## Notes

- Structured data is embedded in the page HTML (not external)
- Uses Next.js `dangerouslySetInnerHTML` for JSON-LD injection
- All dates are in ISO 8601 format (required by Google)
- Headline is automatically truncated to meet Google News requirements
- Image array format ensures compatibility with Google News
- Author uses source name since articles don't have individual authors

## Troubleshooting

### Structured Data Not Showing
- Verify JSON-LD script is in page source
- Check for JSON syntax errors
- Validate using Google Rich Results Test

### Date Format Issues
- Ensure dates are ISO 8601 format
- Check `publishedAt` and `_updatedAt` in Sanity
- Verify date parsing in transformation

### Image Not Showing
- Check image URL is accessible
- Verify fallback image exists in public folder
- Ensure image is in array format

### Author Issues
- Update author URL if you have author pages
- Modify author name logic if needed
- Ensure Person type is used (not Organization)

