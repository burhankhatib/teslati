import { NextResponse } from 'next/server';
import { fetchRSSFeed } from '@/lib/rss-parser';
import { fetchWordPressArticles } from '@/lib/wordpress-fetcher';
import { adminClient } from '@/sanity/lib/adminClient';
import { normalizeGuid, slugify } from '@/lib/utils';

/**
 * Test endpoint to debug cron sync issues
 * Shows detailed information about what articles are found and why they're skipped
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;

  // Verify secret
  if (cronSecret && secret !== cronSecret) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      rssFeeds: [] as any[],
      wordpressSources: [] as any[],
      allArticles: [] as any[],
      existingArticles: 0,
      dateFilter: {
        minDate: '',
        currentDate: '',
      },
      filteredArticles: [] as any[],
      skippedArticles: [] as any[],
      newArticles: [] as any[],
    };

    // Get date filter info - Only articles published from November 21, 2025 onwards
    const minDate = new Date('2025-11-21T00:00:00Z'); // November 21, 2025 at 00:00:00 UTC
    results.dateFilter.minDate = minDate.toISOString();
    results.dateFilter.currentDate = new Date().toISOString();
    results.dateFilter.description = 'Only articles published from November 21, 2025 onwards';

    // Fetch RSS feeds
    console.log('[Test Sync] Fetching RSS feeds...');
    const rssArticles = await fetchRSSFeed();
    console.log(`[Test Sync] Found ${rssArticles.length} RSS articles`);

    // Group RSS articles by source
    const rssBySource = new Map<string, typeof rssArticles>();
    for (const article of rssArticles) {
      const source = article.source?.name || 'Unknown';
      if (!rssBySource.has(source)) {
        rssBySource.set(source, []);
      }
      rssBySource.get(source)!.push(article);
    }

    for (const [source, articles] of rssBySource) {
      results.rssFeeds.push({
        source,
        count: articles.length,
        articles: articles.map(a => ({
          title: a.title,
          url: a.url,
          publishedAt: a.publishedAt,
          guid: a.guid,
        })),
      });
    }

    // Fetch WordPress articles
    console.log('[Test Sync] Fetching WordPress articles...');
    const wordpressArticles = await fetchWordPressArticles();
    console.log(`[Test Sync] Found ${wordpressArticles.length} WordPress articles`);

    // Group WordPress articles by source
    const wpBySource = new Map<string, typeof wordpressArticles>();
    for (const article of wordpressArticles) {
      const source = article.source?.name || 'Unknown';
      if (!wpBySource.has(source)) {
        wpBySource.set(source, []);
      }
      wpBySource.get(source)!.push(article);
    }

    for (const [source, articles] of wpBySource) {
      results.wordpressSources.push({
        source,
        count: articles.length,
        articles: articles.map(a => ({
          title: a.title,
          url: a.url,
          publishedAt: a.publishedAt,
          guid: a.guid,
        })),
      });
    }

    // Combine all articles
    const allArticles = [...rssArticles, ...wordpressArticles];
    results.allArticles = allArticles.map(a => ({
      title: a.title,
      url: a.url,
      publishedAt: a.publishedAt,
      source: a.source?.name,
      guid: a.guid,
    }));

    // Get existing articles by publishedAt (exact match)
    const existingArticles = await adminClient.fetch<
      Array<{ publishedAt: string }>
    >(
      `*[_type == "article"]{ publishedAt }`
    );
    results.existingArticles = existingArticles.length;

    const existingPublishedDates = new Set<string>();
    for (const article of existingArticles) {
      if (article.publishedAt) {
        existingPublishedDates.add(article.publishedAt);
      }
    }

    // Filter articles
    for (const article of allArticles) {
      const publishedDate = new Date(article.publishedAt);
      const guidKey = normalizeGuid(article.guid || article.url || article.id || '');
      const slugKey = slugify(article.title);
      const titleKey = article.title.trim().toLowerCase();

      const articleInfo: any = {
        title: article.title,
        url: article.url,
        source: article.source?.name,
        publishedAt: article.publishedAt,
        publishedDate: publishedDate.toISOString(),
      };

      // Check date
      if (isNaN(publishedDate.getTime()) || publishedDate < minDate) {
        articleInfo.skipReason = `Too old (published: ${publishedDate.toISOString().split('T')[0]}, minDate: ${minDate.toISOString().split('T')[0]})`;
        results.skippedArticles.push(articleInfo);
        continue;
      }

      // Check duplicates by publishedAt (exact match)
      if (existingPublishedDates.has(article.publishedAt)) {
        articleInfo.skipReason = `Duplicate (publishedAt: ${article.publishedAt})`;
        results.skippedArticles.push(articleInfo);
        continue;
      }

      // This is a new article
      articleInfo.status = 'NEW';
      results.newArticles.push(articleInfo);
    }

    results.summary = {
      totalFound: allArticles.length,
      rssCount: rssArticles.length,
      wordpressCount: wordpressArticles.length,
      skipped: results.skippedArticles.length,
      newArticles: results.newArticles.length,
      existingInSanity: existingArticles.length,
    };

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error('[Test Sync] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Test failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

