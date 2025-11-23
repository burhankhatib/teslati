import { NextResponse } from 'next/server';
import { fetchRSSFeed } from '@/lib/rss-parser';
import { fetchWordPressArticles } from '@/lib/wordpress-fetcher';
import { adminClient } from '@/sanity/lib/adminClient';
import { normalizeGuid, slugify } from '@/lib/utils';

/**
 * Find a specific article by title or URL
 * Useful for debugging why an article wasn't imported
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  const searchTitle = url.searchParams.get('title');
  const searchUrl = url.searchParams.get('url');
  const cronSecret = process.env.CRON_SECRET;

  // Verify secret
  if (cronSecret && secret !== cronSecret) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  if (!searchTitle && !searchUrl) {
    return NextResponse.json(
      { error: 'Please provide either ?title=... or ?url=... parameter' },
      { status: 400 }
    );
  }

  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      searchTitle: searchTitle || null,
      searchUrl: searchUrl || null,
      foundInRSS: null as any,
      foundInWordPress: null as any,
      foundInSanity: null as any,
      status: 'not_found',
    };

    // Search in RSS feeds
    console.log('[Find Article] Searching in RSS feeds...');
    const rssArticles = await fetchRSSFeed();
    
    const rssMatch = rssArticles.find(article => {
      if (searchTitle) {
        const titleMatch = article.title.toLowerCase().includes(searchTitle.toLowerCase());
        return titleMatch;
      }
      if (searchUrl) {
        return article.url === searchUrl || article.url.includes(searchUrl) || searchUrl.includes(article.url);
      }
      return false;
    });

    if (rssMatch) {
      results.foundInRSS = {
        title: rssMatch.title,
        url: rssMatch.url,
        publishedAt: rssMatch.publishedAt,
        source: rssMatch.source?.name,
        guid: rssMatch.guid,
        description: rssMatch.description?.substring(0, 200),
      };
      results.status = 'found_in_rss';
    }

    // Search in WordPress articles
    console.log('[Find Article] Searching in WordPress articles...');
    const wordpressArticles = await fetchWordPressArticles();
    
    const wpMatch = wordpressArticles.find(article => {
      if (searchTitle) {
        const titleMatch = article.title.toLowerCase().includes(searchTitle.toLowerCase());
        return titleMatch;
      }
      if (searchUrl) {
        return article.url === searchUrl || article.url.includes(searchUrl) || searchUrl.includes(article.url);
      }
      return false;
    });

    if (wpMatch) {
      results.foundInWordPress = {
        title: wpMatch.title,
        url: wpMatch.url,
        publishedAt: wpMatch.publishedAt,
        source: wpMatch.source?.name,
        guid: wpMatch.guid,
        description: wpMatch.description?.substring(0, 200),
      };
      results.status = 'found_in_wordpress';
    }

    // Search in Sanity
    console.log('[Find Article] Searching in Sanity...');
    let sanityQuery = '';
    if (searchTitle) {
      sanityQuery = `*[_type == "article" && title match "*${searchTitle}*"]`;
    } else if (searchUrl) {
      sanityQuery = `*[_type == "article" && sourceUrl match "*${searchUrl}*"]`;
    }

    if (sanityQuery) {
      const sanityArticles = await adminClient.fetch<Array<{
        _id: string;
        title: string;
        sourceUrl: string;
        publishedAt: string;
        rssGuid?: string;
        slug?: { current: string };
      }>>(
        `${sanityQuery}{ _id, title, sourceUrl, publishedAt, rssGuid, "slug": slug.current }`
      );

      if (sanityArticles.length > 0) {
        results.foundInSanity = sanityArticles.map(article => ({
          _id: article._id,
          title: article.title,
          url: article.sourceUrl,
          publishedAt: article.publishedAt,
          guid: article.rssGuid,
          slug: article.slug?.current,
        }));
        results.status = 'found_in_sanity';
      }
    }

    // Check why it might be skipped
    if (results.foundInRSS || results.foundInWordPress) {
      const article = results.foundInRSS || results.foundInWordPress;
      const publishedDate = new Date(article.publishedAt);
      // Use same date filter as cron sync: November 21, 2025
      const minDate = new Date('2025-11-21T00:00:00Z'); // November 21, 2025 at 00:00:00 UTC
      
      // Check for duplicates in Sanity using same logic as cron sync (exact publishedAt match)
      const articlePublishedAt = article.publishedAt;
      
      // Get existing articles from Sanity
      const existingArticles = await adminClient.fetch<
        Array<{ publishedAt: string; _id: string; title: string }>
      >(
        `*[_type == "article"]{ publishedAt, _id, title }`
      );
      
      const existingPublishedDates = new Set<string>();
      for (const existing of existingArticles) {
        if (existing.publishedAt) {
          existingPublishedDates.add(existing.publishedAt);
        }
      }
      
      const isDuplicate = existingPublishedDates.has(articlePublishedAt);
      const matchingSanityArticle = existingArticles.find(existing => 
        existing.publishedAt === articlePublishedAt
      );

      results.analysis = {
        publishedDate: publishedDate.toISOString(),
        minDate: minDate.toISOString(),
        isTooOld: publishedDate < minDate,
        publishedAt: articlePublishedAt,
        isDuplicate,
        matchingSanityArticle: matchingSanityArticle ? {
          _id: matchingSanityArticle._id,
          title: matchingSanityArticle.title,
          publishedAt: matchingSanityArticle.publishedAt,
        } : null,
        guid: normalizeGuid(article.guid || article.url || ''),
        slug: slugify(article.title),
        titleKey: article.title.trim().toLowerCase(),
        wouldBeSkipped: false,
        skipReason: null as string | null,
      };

      // Check if it would be skipped
      if (results.analysis.isTooOld) {
        results.analysis.wouldBeSkipped = true;
        results.analysis.skipReason = `Too old (published: ${publishedDate.toISOString()}, minDate: ${minDate.toISOString()})`;
      } else if (isDuplicate) {
        results.analysis.wouldBeSkipped = true;
        results.analysis.skipReason = `Already exists in Sanity (publishedAt: ${articlePublishedAt})`;
      }
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error('[Find Article] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

