import { NextResponse } from 'next/server';
import { fetchRSSFeed } from '@/lib/rss-parser';
import { fetchWordPressArticles } from '@/lib/wordpress-fetcher';
import { adminClient } from '@/sanity/lib/adminClient';
import { normalizeGuid } from '@/lib/utils';

/**
 * Debug endpoint to analyze sync issues
 * This endpoint provides detailed information about why articles are not being imported
 * 
 * Usage: /api/cron/debug-sync?secret=YOUR_SECRET&source=Not%20a%20Tesla%20App
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  const sourceFilter = url.searchParams.get('source'); // Optional: filter by source name
  const cronSecret = process.env.CRON_SECRET;

  // Verify secret
  if (cronSecret && secret !== cronSecret) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const debug: any = {
      timestamp: new Date().toISOString(),
      sourceFilter: sourceFilter || 'ALL',
      steps: [],
    };

    // STEP 1: Fetch RSS articles
    debug.steps.push({ step: 1, action: 'Fetching RSS feeds...' });
    const rssArticles = await fetchRSSFeed();
    debug.rssArticlesTotal = rssArticles.length;

    // STEP 2: Fetch WordPress articles
    debug.steps.push({ step: 2, action: 'Fetching WordPress articles...' });
    const wpArticles = await fetchWordPressArticles();
    debug.wpArticlesTotal = wpArticles.length;

    // STEP 3: Combine all articles
    const allArticles = [...rssArticles, ...wpArticles];
    debug.allArticlesTotal = allArticles.length;

    // STEP 4: Filter by source if requested
    let articlesToAnalyze = allArticles;
    if (sourceFilter) {
      articlesToAnalyze = allArticles.filter(a => a.source?.name === sourceFilter);
      debug.filteredArticlesCount = articlesToAnalyze.length;
    }

    // STEP 5: Get existing articles from Sanity
    debug.steps.push({ step: 3, action: 'Fetching existing articles from Sanity...' });
    const existingArticles = await adminClient.fetch<
      Array<{ publishedAt: string; _id: string; title: string; sourceName: string }>
    >(
      `*[_type == "article"]{ publishedAt, _id, title, sourceName }`
    );
    debug.existingArticlesTotal = existingArticles.length;

    // Create a Set of publishedAt values for duplicate detection
    const existingPublishedDates = new Set<string>();
    const existingTitles = new Set<string>();
    for (const article of existingArticles) {
      if (article.publishedAt) {
        existingPublishedDates.add(article.publishedAt.trim());
      }
      if (article.title) {
        existingTitles.add(article.title.trim().toLowerCase());
      }
    }

    // STEP 6: Analyze articles
    const minDate = new Date('2025-11-21T00:00:00Z');
    debug.dateFilter = {
      minDate: minDate.toISOString(),
      description: 'Only articles from November 21, 2025 onwards',
    };

    const analyzedArticles: any[] = [];

    for (const article of articlesToAnalyze.slice(0, 20)) { // Analyze first 20
      const publishedDate = new Date(article.publishedAt);
      const articlePublishedAt = article.publishedAt.trim();
      const articleTitle = article.title.trim().toLowerCase();

      const analysis: any = {
        title: article.title.substring(0, 80),
        source: article.source?.name,
        url: article.url,
        publishedAt: article.publishedAt,
        publishedDate: publishedDate.toISOString(),
        checks: {},
      };

      // Check 1: Valid date
      if (isNaN(publishedDate.getTime())) {
        analysis.checks.validDate = {
          pass: false,
          reason: 'Invalid date format',
        };
      } else {
        analysis.checks.validDate = { pass: true };
      }

      // Check 2: Date filter
      if (publishedDate < minDate) {
        const hoursDiff = Math.floor((new Date().getTime() - publishedDate.getTime()) / (1000 * 60 * 60));
        analysis.checks.dateFilter = {
          pass: false,
          reason: `Too old (${hoursDiff} hours ago, before ${minDate.toISOString()})`,
        };
      } else {
        analysis.checks.dateFilter = { pass: true };
      }

      // Check 3: Duplicate by publishedAt
      const isDuplicateByDate = existingPublishedDates.has(articlePublishedAt);
      if (isDuplicateByDate) {
        const existingArticle = existingArticles.find(a => a.publishedAt?.trim() === articlePublishedAt);
        analysis.checks.duplicateByDate = {
          pass: false,
          reason: `Duplicate publishedAt: ${articlePublishedAt}`,
          existingArticle: existingArticle ? {
            _id: existingArticle._id,
            title: existingArticle.title.substring(0, 60),
            publishedAt: existingArticle.publishedAt,
          } : null,
        };
      } else {
        analysis.checks.duplicateByDate = { pass: true };
      }

      // Check 4: Duplicate by title
      const isDuplicateByTitle = existingTitles.has(articleTitle);
      if (isDuplicateByTitle) {
        const existingArticle = existingArticles.find(a => a.title?.trim().toLowerCase() === articleTitle);
        analysis.checks.duplicateByTitle = {
          pass: false,
          reason: 'Duplicate title found in Sanity',
          existingArticle: existingArticle ? {
            _id: existingArticle._id,
            title: existingArticle.title.substring(0, 60),
            publishedAt: existingArticle.publishedAt,
          } : null,
        };
      } else {
        analysis.checks.duplicateByTitle = { pass: true };
      }

      // Overall status
      analysis.wouldImport = 
        analysis.checks.validDate?.pass &&
        analysis.checks.dateFilter?.pass &&
        analysis.checks.duplicateByDate?.pass;

      // Why not importing?
      if (!analysis.wouldImport) {
        const reasons: string[] = [];
        if (!analysis.checks.validDate?.pass) reasons.push(analysis.checks.validDate.reason);
        if (!analysis.checks.dateFilter?.pass) reasons.push(analysis.checks.dateFilter.reason);
        if (!analysis.checks.duplicateByDate?.pass) reasons.push(analysis.checks.duplicateByDate.reason);
        analysis.skipReasons = reasons;
      }

      analyzedArticles.push(analysis);
    }

    debug.analyzedArticles = analyzedArticles;

    // Summary
    const wouldImport = analyzedArticles.filter(a => a.wouldImport).length;
    const wouldSkip = analyzedArticles.filter(a => !a.wouldImport).length;

    debug.summary = {
      totalAnalyzed: analyzedArticles.length,
      wouldImport,
      wouldSkip,
      skipReasons: analyzedArticles
        .filter(a => !a.wouldImport)
        .reduce((acc, a) => {
          a.skipReasons?.forEach((reason: string) => {
            acc[reason] = (acc[reason] || 0) + 1;
          });
          return acc;
        }, {} as Record<string, number>),
    };

    return NextResponse.json(debug, { status: 200 });
  } catch (error) {
    console.error('[Debug Sync] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Debug failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

