import { NextResponse } from 'next/server';
import { adminClient } from '@/sanity/lib/adminClient';

/**
 * Check if a specific article exists in Sanity
 * Search by title or publishedAt
 * 
 * Usage: 
 * - /api/cron/check-article?secret=YOUR_SECRET&title=fsd+in+europe
 * - /api/cron/check-article?secret=YOUR_SECRET&publishedAt=2025-11-23T14:15:00.000Z
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  const titleSearch = url.searchParams.get('title');
  const publishedAtSearch = url.searchParams.get('publishedAt');
  const cronSecret = process.env.CRON_SECRET;

  // Verify secret
  if (cronSecret && secret !== cronSecret) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  if (!titleSearch && !publishedAtSearch) {
    return NextResponse.json(
      { error: 'Please provide either ?title=... or ?publishedAt=... parameter' },
      { status: 400 }
    );
  }

  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      searchCriteria: {
        title: titleSearch || null,
        publishedAt: publishedAtSearch || null,
      },
      foundArticles: [],
    };

    // Search by title
    if (titleSearch) {
      const titleArticles = await adminClient.fetch<Array<{
        _id: string;
        title: string;
        publishedAt: string;
        sourceName: string;
        sourceUrl: string;
        _createdAt: string;
      }>>(
        `*[_type == "article" && title match "*${titleSearch}*"]{ 
          _id, 
          title, 
          publishedAt, 
          sourceName, 
          sourceUrl,
          _createdAt
        }`
      );

      results.foundArticles = titleArticles.map(a => ({
        ...a,
        searchMethod: 'title',
      }));
    }

    // Search by publishedAt
    if (publishedAtSearch) {
      const dateArticles = await adminClient.fetch<Array<{
        _id: string;
        title: string;
        publishedAt: string;
        sourceName: string;
        sourceUrl: string;
        _createdAt: string;
      }>>(
        `*[_type == "article" && publishedAt == $publishedAt]{ 
          _id, 
          title, 
          publishedAt, 
          sourceName, 
          sourceUrl,
          _createdAt
        }`,
        { publishedAt: publishedAtSearch }
      );

      // Merge with title results (avoid duplicates)
      for (const article of dateArticles) {
        if (!results.foundArticles.find((a: any) => a._id === article._id)) {
          results.foundArticles.push({
            ...article,
            searchMethod: 'publishedAt',
          });
        }
      }
    }

    results.totalFound = results.foundArticles.length;
    results.status = results.totalFound > 0 ? 'found' : 'not_found';

    // Additional info if found
    if (results.totalFound > 0) {
      results.foundArticles = results.foundArticles.map((article: any) => ({
        ...article,
        publishedAtNormalized: article.publishedAt?.trim(),
        titleNormalized: article.title?.trim().toLowerCase(),
      }));
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error('[Check Article] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

