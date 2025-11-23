import { NextResponse } from 'next/server';
import { getArticleBySlug } from '@/lib/sanity-queries';

/**
 * Fetch article from Sanity by slug
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const article = await getArticleBySlug(slug);
    
    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }
    
    // Transform to match expected format (Arabic as primary)
    const transformedArticle = {
      id: article._id,
      slug: article.slug.current,
      source: {
        id: null,
        name: article.sourceName,
      },
      author: null,
      title: article.titleAr, // Arabic title (primary)
      description: article.descriptionAr, // Arabic description (primary)
      url: article.sourceUrl,
      urlToImage: article.imageUrl,
      publishedAt: article.publishedAt,
      content: article.contentAr, // Arabic content (primary)
      scrapedContent: article.htmlContentAr, // Arabic HTML content (primary)
      scrapedText: article.contentAr,
      scrapingSuccess: true,
      scrapingError: undefined,
    };
    
    return NextResponse.json(transformedArticle);
  } catch (error) {
    console.error('Error fetching article from Sanity:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch article',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

