import { NextResponse } from 'next/server';
import { getArticles } from '@/lib/sanity-queries';

/**
 * Fetch articles from Sanity (not RSS)
 * Articles are imported via /api/sync-articles
 * 
 * Query params:
 * - search: Search query to filter articles by title/description
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('search')?.trim().toLowerCase() || '';

    const articles = await getArticles();
    
    // Filter articles if search query is provided
    let filteredArticles = articles;
    if (searchQuery) {
      filteredArticles = articles.filter(article => {
        const titleMatch = article.titleAr?.toLowerCase().includes(searchQuery) || 
                          article.title?.toLowerCase().includes(searchQuery);
        const descMatch = article.descriptionAr?.toLowerCase().includes(searchQuery) ||
                          article.description?.toLowerCase().includes(searchQuery);
        const contentMatch = article.contentAr?.toLowerCase().includes(searchQuery) ||
                            article.content?.toLowerCase().includes(searchQuery);
        return titleMatch || descMatch || contentMatch;
      });
    }
    
    // Transform Sanity articles to match expected format
    const transformedArticles = filteredArticles.map(article => ({
      id: article._id,
      slug: article.slug.current,
      source: {
        id: null,
        name: article.sourceName,
      },
      author: null,
      title: article.titleAr, // Use Arabic title as primary
      description: article.descriptionAr, // Use Arabic description
      url: article.sourceUrl,
      urlToImage: article.imageUrl,
      publishedAt: article.publishedAt,
      content: article.contentAr, // Use Arabic content
      htmlContent: article.htmlContentAr, // Use Arabic HTML content
    }));
    
    // Limit search results to 10 for better performance
    const limitedArticles = searchQuery 
      ? transformedArticles.slice(0, 10)
      : transformedArticles;
    
    return NextResponse.json({
      status: 'ok',
      totalResults: limitedArticles.length,
      articles: limitedArticles,
    });
  } catch (error) {
    console.error('Error fetching articles from Sanity:', error);
    
    // Return empty array instead of error to prevent homepage from crashing
    // This allows the site to load even if Sanity is unavailable
    return NextResponse.json({
      status: 'ok',
      totalResults: 0,
      articles: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

