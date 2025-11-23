import { NextResponse } from 'next/server';
import { adminClient } from '@/sanity/lib/adminClient';

/**
 * Google News Sitemap Route Handler
 * 
 * Returns a dynamic XML sitemap for Google News containing articles
 * published in the last 48 hours.
 * 
 * Google News Requirements:
 * - Only articles published in the last 48 hours
 * - Proper XML namespaces
 * - Required news:news tags (publication, publication_date, title)
 * - ISO 8601 date format
 * 
 * Accessible at: https://teslawy.com/news-sitemap.xml
 */
export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://teslawy.com';

  try {
    // Calculate date 48 hours ago
    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
    const minDateISO = fortyEightHoursAgo.toISOString();

    console.log(`[News Sitemap] Fetching articles published after: ${minDateISO}`);

    // Fetch articles published in the last 48 hours
    const articles = await adminClient.fetch<
      Array<{
        slug: { current: string };
        title: string;
        titleAr: string;
        publishedAt: string;
      }>
    >(
      `*[_type == "article" && isPublished == true && publishedAt >= $minDate]{
        slug,
        title,
        titleAr,
        publishedAt
      } | order(publishedAt desc)`,
      { minDate: minDateISO }
    );

    console.log(`[News Sitemap] Found ${articles.length} articles published in the last 48 hours`);

    // Generate XML sitemap
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${articles
  .filter((article) => article.slug?.current && article.publishedAt)
  .map((article) => {
    const slug = article.slug.current;
    const encodedSlug = encodeURIComponent(slug);
    const articleUrl = `${siteUrl}/article/${encodedSlug}`;
    
    // Use Arabic title as primary (site is Arabic-focused)
    const articleTitle = article.titleAr || article.title || '';
    
    // Format publishedAt to ISO 8601 (required format)
    const publishedDate = new Date(article.publishedAt);
    const isoDate = publishedDate.toISOString();
    
    // Escape XML special characters in title
    const escapedTitle = articleTitle
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    return `  <url>
    <loc>${articleUrl}</loc>
    <news:news>
      <news:publication>
        <news:name>Teslawy</news:name>
        <news:language>ar</news:language>
      </news:publication>
      <news:publication_date>${isoDate}</news:publication_date>
      <news:title>${escapedTitle}</news:title>
    </news:news>
  </url>`;
  })
  .join('\n')}
</urlset>`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('[News Sitemap] Error generating news sitemap:', error);
    
    // Return empty sitemap on error (valid XML)
    const emptyXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
</urlset>`;

    return new NextResponse(emptyXml, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  }
}

