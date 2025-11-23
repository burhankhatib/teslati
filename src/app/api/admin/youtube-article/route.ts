import { NextResponse } from 'next/server';
import { adminClient } from '@/sanity/lib/adminClient';
import { getYouTubeVideoInfo, generateYouTubeEmbedHtml } from '@/lib/youtube-utils';
import { translateText, generateStyledHtmlFromRSS } from '@/lib/translator';
import { slugify } from '@/lib/utils';
import { uploadImageToSanity } from '@/lib/sanity-image-upload';
import { urlFor } from '@/sanity/lib/image';

/**
 * YOUTUBE ARTICLE CREATOR API
 * 
 * This endpoint:
 * 1. Extracts YouTube video information (title, transcript, thumbnail)
 * 2. Generates Arabic article using AI
 * 3. Uploads thumbnail to Sanity
 * 4. Creates article in Sanity with embedded video
 * 
 * Authentication: Requires CRON_SECRET or YOUTUBE_ADMIN_PASSWORD
 */
export async function POST(request: Request) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const youtubePasswordEnv = process.env.YOUTUBE_ADMIN_PASSWORD;
    const youtubePassword = youtubePasswordEnv || cronSecret;
    
    // Debug logging
    console.log('[YouTube Article] Auth check:', {
      hasYoutubePasswordEnv: !!youtubePasswordEnv,
      hasCronSecret: !!cronSecret,
      youtubePasswordSet: !!youtubePassword,
      youtubePasswordLength: youtubePassword?.length || 0,
      authHeaderPresent: !!authHeader,
      authHeaderPrefix: authHeader?.substring(0, 20) || 'none',
    });
    
    if (!youtubePassword) {
      console.error('[YouTube Article] ✗ No password configured');
      return NextResponse.json(
        { error: 'YOUTUBE_ADMIN_PASSWORD or CRON_SECRET not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { youtubeUrl, password } = body;

    // Trim passwords for comparison (handle whitespace issues)
    const providedPassword = (password || '').toString().trim();
    const expectedPassword = (youtubePassword || '').toString().trim();
    
    // Extract password from Bearer token if present
    const headerPassword = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';
    
    // Check authentication: either Authorization header OR password in body
    // Use strict equality for exact match
    const isAuthorizedByHeader = headerPassword && headerPassword === expectedPassword;
    const isAuthorizedByPassword = providedPassword && providedPassword === expectedPassword;
    
    // Detailed debug logging
    console.log('[YouTube Article] Password comparison:', {
      headerPasswordLength: headerPassword.length,
      providedPasswordLength: providedPassword.length,
      expectedPasswordLength: expectedPassword.length,
      headerMatch: isAuthorizedByHeader,
      passwordMatch: isAuthorizedByPassword,
      passwordsMatch: providedPassword === expectedPassword,
      headerMatches: headerPassword === expectedPassword,
    });
    
    if (!isAuthorizedByHeader && !isAuthorizedByPassword) {
      console.error('[YouTube Article] ✗ Authentication failed');
      return NextResponse.json(
        { 
          error: 'Unauthorized. Please provide valid authentication (Authorization header or password in body).',
          debug: process.env.NODE_ENV === 'development' ? {
            expectedLength: expectedPassword.length,
            providedLength: providedPassword.length,
            headerLength: headerPassword.length,
          } : undefined
        },
        { status: 401 }
      );
    }
    
    console.log('[YouTube Article] ✓ Authentication successful');

    if (!youtubeUrl) {
      return NextResponse.json(
        { error: 'YouTube URL is required' },
        { status: 400 }
      );
    }

    console.log(`[YouTube Article] Processing video: ${youtubeUrl}`);

    // Step 1: Get YouTube video information
    console.log(`[YouTube Article] Step 1: Fetching video information...`);
    const videoInfo = await getYouTubeVideoInfo(youtubeUrl);
    
    if (!videoInfo) {
      return NextResponse.json(
        { error: 'Failed to fetch YouTube video information' },
        { status: 400 }
      );
    }

    console.log(`[YouTube Article] ✓ Video title: ${videoInfo.title}`);
    console.log(`[YouTube Article] ✓ Transcript length: ${videoInfo.transcript.length} chars`);

    // Step 2: Upload thumbnail to Sanity
    console.log(`[YouTube Article] Step 2: Uploading thumbnail to Sanity...`);
    const imageUploadResult = await uploadImageToSanity(videoInfo.thumbnailUrl);
    
    let imageUrl = videoInfo.thumbnailUrl;
    let sanityImageAssetId: string | null = null;

    if (imageUploadResult.sanityAssetId) {
      sanityImageAssetId = imageUploadResult.sanityAssetId;
      try {
        const sanityImage = {
          asset: {
            _ref: imageUploadResult.sanityAssetId,
            _type: 'reference' as const,
          },
        };
        imageUrl = urlFor(sanityImage).width(1600).height(900).url() || videoInfo.thumbnailUrl;
        console.log(`[YouTube Article] ✓ Thumbnail uploaded to Sanity: ${sanityImageAssetId}`);
      } catch (error) {
        console.warn(`[YouTube Article] Failed to generate Sanity URL, using original`);
      }
    } else {
      console.warn(`[YouTube Article] ⚠️  Failed to upload thumbnail, using original URL`);
    }

    // Step 3: Translate title to Arabic
    console.log(`[YouTube Article] Step 3: Translating title to Arabic...`);
    const titleTranslation = await translateText(videoInfo.title, 'ar', 'en');
    const titleAr = titleTranslation.success ? titleTranslation.translatedText : videoInfo.title;

    // Step 4: Generate article content using AI
    console.log(`[YouTube Article] Step 4: Generating article content with AI...`);
    const articleContent = await generateStyledHtmlFromRSS(
      videoInfo.title,
      videoInfo.transcript.substring(0, 500), // Use first 500 chars as description
      videoInfo.transcript,
      [videoInfo.thumbnailUrl]
    );

    if (!articleContent.success || !articleContent.translatedText) {
      return NextResponse.json(
        { error: 'Failed to generate article content', details: articleContent.error },
        { status: 500 }
      );
    }

    // Step 5: Don't embed video in HTML - it will be displayed separately from youtubeUrl field
    // Remove any existing YouTube embeds from the content
    const htmlContentAr = articleContent.translatedText.replace(
      /<div[^>]*class="youtube-embed-minimal"[^>]*>[\s\S]*?<\/div>/gi,
      ''
    );

    // Step 6: Create slug from title
    const slug = slugify(videoInfo.title);

    // Check if article with same slug already exists
    const existingArticles = await adminClient.fetch(
      `*[_type == "article" && slug.current == $slug][0]`,
      { slug }
    );

    if (existingArticles) {
      return NextResponse.json(
        { error: 'Article with this title already exists', slug },
        { status: 400 }
      );
    }

    // Step 7: Create article in Sanity
    console.log(`[YouTube Article] Step 7: Creating article in Sanity...`);
    const sanityArticle = {
      _type: 'article',
      title: videoInfo.title,
      titleAr: titleAr,
      slug: {
        _type: 'slug',
        current: slug,
      },
      description: videoInfo.transcript.substring(0, 300),
      descriptionAr: articleContent.translatedText.substring(0, 300).replace(/<[^>]*>/g, ''),
      content: videoInfo.transcript,
      contentAr: articleContent.translatedText.replace(/<[^>]*>/g, ''),
      htmlContent: '',
      htmlContentAr: htmlContentAr,
      imageUrl: imageUrl,
      image: sanityImageAssetId ? {
        _type: 'image',
        asset: {
          _type: 'reference',
          _ref: sanityImageAssetId,
        },
      } : undefined,
      publishedAt: new Date().toISOString(),
      sourceUrl: `https://www.youtube.com/watch?v=${videoInfo.videoId}`,
      youtubeUrl: `https://www.youtube.com/watch?v=${videoInfo.videoId}`,
      sourceName: 'YouTube',
      rssGuid: `youtube-${videoInfo.videoId}`,
      isPublished: true,
    };

    const createdArticle = await adminClient.create(sanityArticle);
    console.log(`[YouTube Article] ✓ Article created successfully: ${createdArticle._id}`);

    return NextResponse.json({
      success: true,
      article: {
        id: createdArticle._id,
        slug: slug,
        title: titleAr,
        url: `/article/${slug}`,
      },
      video: {
        videoId: videoInfo.videoId,
        title: videoInfo.title,
        thumbnailUrl: imageUrl,
      },
    });
  } catch (error) {
    console.error('[YouTube Article] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create article from YouTube video',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

