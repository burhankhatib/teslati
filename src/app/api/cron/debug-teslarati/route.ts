import { NextResponse } from 'next/server';

/**
 * Debug endpoint to test Teslarati WordPress API directly
 * Tests image extraction and content formatting
 */
export async function GET() {
  try {
    console.log('[Debug Teslarati] Fetching from WordPress API...');
    
    const url = 'https://www.teslarati.com/wp-json/wp/v2/posts?per_page=3&_embed';
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TeslaNewsBot/1.0)',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const posts = await response.json();
    
    console.log(`[Debug Teslarati] Fetched ${posts.length} posts`);

    // Analyze each post
    const analysis = posts.map((post: any) => {
      const title = post.title?.rendered || 'No title';
      
      // Check for featured media
      let featuredMedia = null;
      if (post._embedded?.['wp:featuredmedia']?.[0]) {
        const media = post._embedded['wp:featuredmedia'][0];
        featuredMedia = {
          hasMedia: true,
          source_url: media.source_url || null,
          sizes: media.media_details?.sizes ? Object.keys(media.media_details.sizes) : [],
          large: media.media_details?.sizes?.large?.source_url || null,
          medium_large: media.media_details?.sizes?.medium_large?.source_url || null,
          full: media.media_details?.sizes?.full?.source_url || null,
        };
      }
      
      // Extract first image from content
      const content = post.content?.rendered || '';
      const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
      const contentImage = imgMatch ? imgMatch[1] : null;
      
      // Extract first image from excerpt
      const excerpt = post.excerpt?.rendered || '';
      const excerptImgMatch = excerpt.match(/<img[^>]+src=["']([^"']+)["']/i);
      const excerptImage = excerptImgMatch ? excerptImgMatch[1] : null;

      return {
        title: title.substring(0, 60) + '...',
        link: post.link,
        date: post.date,
        featuredMedia,
        contentImage,
        excerptImage,
        contentLength: content.length,
        excerptLength: excerpt.length,
        hasEmbedded: !!post._embedded,
        embeddedKeys: post._embedded ? Object.keys(post._embedded) : [],
      };
    });

    return NextResponse.json({
      success: true,
      source: 'TESLARATI',
      apiUrl: url,
      postsAnalyzed: posts.length,
      analysis,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
  } catch (error) {
    console.error('[Debug Teslarati] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch from Teslarati',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

