import { NextResponse } from 'next/server';
import { fetchRSSFeed } from '@/lib/rss-parser';

/**
 * Test endpoint to check date parsing from RSS feeds
 * Useful for debugging timezone issues
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
      currentTime: {
        local: new Date().toString(),
        utc: new Date().toUTCString(),
        iso: new Date().toISOString(),
        timezoneOffset: new Date().getTimezoneOffset(),
      },
      minDate: {
        value: new Date('2025-09-22T20:00:00Z').toISOString(),
        local: new Date('2025-09-22T20:00:00Z').toString(),
        utc: new Date('2025-09-22T20:00:00Z').toUTCString(),
      },
      sources: [] as any[],
    };

    // Fetch RSS feeds
    console.log('[Test Date Parsing] Fetching RSS feeds...');
    const rssArticles = await fetchRSSFeed();
    console.log(`[Test Date Parsing] Found ${rssArticles.length} articles from RSS feeds`);

    // Group by source
    const bySource = new Map<string, typeof rssArticles>();
    for (const article of rssArticles) {
      const source = article.source?.name || 'Unknown';
      if (!bySource.has(source)) {
        bySource.set(source, []);
      }
      bySource.get(source)!.push(article);
    }

    // Analyze dates for each source
    for (const [source, articles] of bySource) {
      const sourceData: any = {
        name: source,
        totalArticles: articles.length,
        articles: [] as any[],
        dateRange: {
          oldest: null as string | null,
          newest: null as string | null,
        },
        timezoneAnalysis: {
          allUTC: true,
          hasTimezoneInfo: false,
          timezoneOffsets: [] as number[],
        },
      };

      // Analyze first 10 articles (or all if less than 10)
      const articlesToAnalyze = articles.slice(0, 10);
      
      for (const article of articlesToAnalyze) {
        const publishedDate = new Date(article.publishedAt);
        const articleData: any = {
          title: article.title.substring(0, 60),
          url: article.url,
          publishedAt: {
            raw: article.publishedAt,
            parsed: publishedDate.toString(),
            utc: publishedDate.toUTCString(),
            iso: publishedDate.toISOString(),
            timestamp: publishedDate.getTime(),
            timezoneOffset: publishedDate.getTimezoneOffset(),
          },
          comparison: {
            isAfterMinDate: publishedDate >= new Date('2025-09-22T20:00:00Z'),
            hoursFromNow: Math.floor((new Date().getTime() - publishedDate.getTime()) / (1000 * 60 * 60)),
            daysFromNow: Math.floor((new Date().getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24)),
          },
        };

        sourceData.articles.push(articleData);
        sourceData.timezoneAnalysis.timezoneOffsets.push(publishedDate.getTimezoneOffset());
      }

      // Calculate date range
      if (articles.length > 0) {
        const dates = articles.map(a => new Date(a.publishedAt)).sort((a, b) => a.getTime() - b.getTime());
        sourceData.dateRange.oldest = dates[0].toISOString();
        sourceData.dateRange.newest = dates[dates.length - 1].toISOString();
      }

      // Check if all dates are UTC (timezone offset should be 0)
      const uniqueOffsets = new Set(sourceData.timezoneAnalysis.timezoneOffsets);
      sourceData.timezoneAnalysis.allUTC = uniqueOffsets.size === 1 && uniqueOffsets.has(0);
      sourceData.timezoneAnalysis.hasTimezoneInfo = uniqueOffsets.size > 0;

      results.sources.push(sourceData);
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error('[Test Date Parsing] Error:', error);
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

