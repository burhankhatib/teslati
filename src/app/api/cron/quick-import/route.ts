import { NextResponse } from 'next/server';
import { fetchRSSFeed } from '@/lib/rss-parser';
import { fetchWordPressArticles } from '@/lib/wordpress-fetcher';
import { adminClient } from '@/sanity/lib/adminClient';
import { slugify, normalizeGuid } from '@/lib/utils';

/**
 * Quick import endpoint - imports ONE article without translation/AI
 * Fast enough to avoid timeout (under 10 seconds)
 * 
 * Purpose: Import articles quickly, add translations later via separate process
 */
export async function GET(request: Request) {
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  
  if (!isVercelCron) {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      const url = new URL(request.url);
      const querySecret = url.searchParams.get('secret');
      
      if (authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
  }

  try {
    console.log('[Quick Import] Starting...');

    // Fetch articles
    const rssArticles = await fetchRSSFeed();
    const wordpressArticles = await fetchWordPressArticles();
    const allArticles = [...rssArticles, ...wordpressArticles];

    // Filter by date - November 20, 2025 onwards
    const minDate = new Date('2025-11-20T00:00:00Z');
    const validArticles = allArticles.filter(article => {
      const publishedDate = new Date(article.publishedAt);
      return !isNaN(publishedDate.getTime()) && publishedDate >= minDate;
    });

    console.log(`[Quick Import] Found ${validArticles.length} valid articles`);

    if (validArticles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No articles to import',
        imported: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // Import ONLY ONE article (fastest possible)
    const article = validArticles[0];
    const slug = slugify(article.title);

    console.log(`[Quick Import] Importing: ${article.title.substring(0, 50)}...`);

    // Create article in Sanity WITHOUT translation/AI (add later)
    const sanityArticle = {
      _type: 'article',
      title: article.title,
      titleAr: article.title, // Same as English for now
      slug: {
        _type: 'slug',
        current: slug,
      },
      description: article.description || '',
      descriptionAr: article.description || '', // Same as English for now
      content: article.content || article.description || '',
      contentAr: article.content || article.description || '', // Same as English for now
      htmlContent: '',
      htmlContentAr: '', // Empty for now
      imageUrl: article.urlToImage || null,
      image: undefined, // Skip image upload for speed
      publishedAt: article.publishedAt,
      sourceUrl: article.url,
      sourceName: article.source.name,
      rssGuid: normalizeGuid(article.guid || article.url || article.id || ''),
      isPublished: true,
    };

    await adminClient.create(sanityArticle);
    console.log(`[Quick Import] ✅ Imported successfully!`);

    return NextResponse.json({
      success: true,
      message: 'Imported 1 article',
      imported: 1,
      article: {
        title: article.title.substring(0, 60),
        source: article.source.name,
        publishedAt: article.publishedAt,
      },
      remaining: validArticles.length - 1,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('[Quick Import] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Import failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export const POST = GET;

