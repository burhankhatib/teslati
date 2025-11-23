import { NextResponse } from 'next/server';
import { adminClient } from '@/sanity/lib/adminClient';

/**
 * Check articles image status
 */
export async function GET() {
  try {
    // Get latest 5 articles with their image status
    const articles = await adminClient.fetch<
      Array<{
        _id: string;
        _createdAt: string;
        title: string;
        sourceName: string;
        imageUrl: string | null;
        hasImageAsset: boolean;
        htmlContentArLength: number;
      }>
    >(
      `*[_type == "article"] | order(_createdAt desc) [0...5] {
        _id,
        _createdAt,
        title,
        sourceName,
        imageUrl,
        "hasImageAsset": defined(image.asset),
        "htmlContentArLength": length(htmlContentAr)
      }`
    );

    // Count articles needing enhancement
    const needsImageUpload = await adminClient.fetch<number>(
      `count(*[_type == "article" && 
              imageUrl != null && 
              imageUrl != "" && 
              !defined(image.asset) &&
              !(imageUrl match "cdn.sanity.io*")])`
    );

    const needsHtml = await adminClient.fetch<number>(
      `count(*[_type == "article" && (htmlContentAr == null || htmlContentAr == "")])`
    );

    return NextResponse.json({
      success: true,
      latestArticles: articles.map(a => ({
        id: a._id,
        created: a._createdAt,
        title: a.title.substring(0, 60),
        source: a.sourceName,
        imageUrl: a.imageUrl ? a.imageUrl.substring(0, 80) + '...' : null,
        hasImageAsset: a.hasImageAsset,
        hasHtmlContent: a.htmlContentArLength > 0,
        htmlLength: a.htmlContentArLength,
      })),
      stats: {
        total: articles.length,
        needsImageUpload,
        needsHtml,
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('[Check Images] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check images',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

