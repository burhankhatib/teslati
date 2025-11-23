# Google News Sitemap Implementation

## ✅ Implementation Complete

A dynamic Google News sitemap has been created at `/news-sitemap.xml` that automatically includes articles published in the last 48 hours.

## Route Handler

**Location:** `src/app/news-sitemap.xml/route.ts`

**Accessible at:** `https://teslawy.com/news-sitemap.xml`

## Features

### ✅ Google News Requirements Met

1. **48-Hour Filter**
   - Only includes articles published in the last 48 hours
   - Automatically filters using `publishedAt >= $minDate` query

2. **Proper XML Namespaces**
   - `xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"`
   - `xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"`

3. **Required `<news:news>` Tags**
   - `<news:publication>` with:
     - `<news:name>Teslawy</news:name>`
     - `<news:language>ar</news:language>` (Arabic)
   - `<news:publication_date>` in ISO 8601 format
   - `<news:title>` with XML-escaped article title

4. **Proper Headers**
   - `Content-Type: text/xml; charset=utf-8`
   - `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`

## XML Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <url>
    <loc>https://teslawy.com/article/article-slug</loc>
    <news:news>
      <news:publication>
        <news:name>Teslawy</news:name>
        <news:language>ar</news:language>
      </news:publication>
      <news:publication_date>2025-01-15T10:30:00.000Z</news:publication_date>
      <news:title>Article Title in Arabic</news:title>
    </news:news>
  </url>
  <!-- More articles... -->
</urlset>
```

## Implementation Details

### Article Selection
- Fetches from Sanity CMS using `adminClient`
- Filters: `isPublished == true` AND `publishedAt >= 48 hours ago`
- Orders by `publishedAt desc` (newest first)

### Title Handling
- Uses Arabic title (`titleAr`) as primary
- Falls back to English title (`title`) if Arabic not available
- XML-escapes special characters (`&`, `<`, `>`, `"`, `'`)

### URL Generation
- Base URL: `https://teslawy.com/article/{slug}`
- Slugs are URL-encoded for proper handling of Arabic characters

### Error Handling
- Returns empty but valid XML sitemap on errors
- Logs errors to console for debugging
- Never returns invalid XML

## Testing

### Test Locally
```bash
# Start dev server
npm run dev

# Visit in browser
http://localhost:3000/news-sitemap.xml
```

### Test Production
```bash
# After deployment
curl https://teslawy.com/news-sitemap.xml
```

### Validate XML
Use online XML validators or Google Search Console to verify the sitemap format.

## Google News Submission

### Steps to Submit

1. **Verify Your Site**
   - Ensure your site is verified in Google Search Console
   - Add `https://teslawy.com` as a property

2. **Submit News Sitemap**
   - Go to Google Search Console
   - Navigate to **Sitemaps** section
   - Add sitemap: `news-sitemap.xml`
   - Click **Submit**

3. **Monitor Status**
   - Check sitemap status in Search Console
   - Look for any errors or warnings
   - Ensure articles are being indexed

### Google News Requirements Checklist

- ✅ Sitemap contains only articles published in last 48 hours
- ✅ Proper XML namespaces included
- ✅ Required `<news:news>` tags present
- ✅ Publication name and language specified
- ✅ Publication dates in ISO 8601 format
- ✅ Article titles properly escaped
- ✅ Valid XML structure
- ✅ Proper HTTP headers
- ✅ Caching headers configured

## Caching Strategy

- **s-maxage=3600**: Cache for 1 hour at CDN level
- **stale-while-revalidate=86400**: Serve stale content for up to 24 hours while revalidating

This ensures:
- Fresh content every hour
- Fast response times
- Reduced server load

## Maintenance

### Automatic Updates
- Sitemap updates automatically as new articles are published
- No manual intervention required
- Articles older than 48 hours are automatically excluded

### Monitoring
- Check Google Search Console for sitemap status
- Monitor article indexing in Google News
- Review sitemap errors if any occur

## Troubleshooting

### Sitemap Not Found
- Verify route is deployed: `https://teslawy.com/news-sitemap.xml`
- Check build logs for route registration
- Ensure Next.js build completed successfully

### No Articles in Sitemap
- Verify articles exist with `isPublished == true`
- Check articles have `publishedAt` dates within last 48 hours
- Review Sanity query logs for errors

### Google Not Indexing
- Ensure site is verified in Google Search Console
- Submit sitemap manually if auto-discovery fails
- Check robots.txt doesn't block `/news-sitemap.xml`
- Verify XML is valid and properly formatted

## Related Files

- `src/app/sitemap.ts` - Regular sitemap (all articles)
- `src/app/news-sitemap.xml/route.ts` - News sitemap (last 48 hours)
- `src/lib/sanity-queries.ts` - Article fetching utilities
- `src/sanity/lib/adminClient.ts` - Sanity admin client

## Notes

- The sitemap is dynamically generated on each request
- Articles are filtered server-side for optimal performance
- XML is generated fresh to ensure accuracy
- Caching reduces server load while maintaining freshness

