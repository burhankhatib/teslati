import { NextResponse } from 'next/server';
import { adminClient } from '@/sanity/lib/adminClient';
import { generateStyledHtmlFromRSS } from '@/lib/translator';
import { uploadImagesToSanity, replaceImageUrlsInHtml, getSanityImageUrl } from '@/lib/sanity-image-upload';
import { extractAllImages } from '@/lib/rss-parser';

/**
 * Enhancement endpoint - adds AI HTML and uploads images to existing articles
 * 
 * This runs AFTER quick-import to add rich content without timeout
 * Processes ONE article per run
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
    console.log('[Enhance] Starting article enhancement...');

    // Find articles that need enhancement (empty htmlContentAr)
    const articlesToEnhance = await adminClient.fetch<
      Array<{
        _id: string;
        title: string;
        description: string;
        content: string;
        imageUrl: string;
        sourceUrl: string;
        htmlContentAr: string;
      }>
    >(
      `*[_type == "article" && (htmlContentAr == null || htmlContentAr == "")] | order(_createdAt desc) [0...1] {
        _id,
        title,
        description,
        content,
        imageUrl,
        sourceUrl,
        htmlContentAr
      }`
    );

    if (articlesToEnhance.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No articles need enhancement',
        enhanced: 0,
        timestamp: new Date().toISOString(),
      });
    }

    const article = articlesToEnhance[0];
    console.log(`[Enhance] Processing: ${article.title.substring(0, 50)}...`);

    // Extract images from content
    const allImages = extractAllImages(article.content, article.sourceUrl);
    const uniqueImages = [...new Set(allImages)];
    
    console.log(`[Enhance] Found ${uniqueImages.length} images to process`);

    // Upload main image if needed
    let sanityImageAssetId: string | null = null;
    if (article.imageUrl && !article.imageUrl.includes('cdn.sanity.io')) {
      console.log(`[Enhance] Uploading main image from: ${article.imageUrl.substring(0, 100)}...`);
      try {
        const imageMap = await uploadImagesToSanity([article.imageUrl]);
        const uploadedAssetId = imageMap.get(article.imageUrl);
        if (uploadedAssetId) {
          sanityImageAssetId = uploadedAssetId;
          console.log(`[Enhance] ✓ Main image uploaded to Sanity: ${uploadedAssetId}`);
        } else {
          console.warn(`[Enhance] ⚠️ Failed to upload main image (no asset ID returned)`);
        }
      } catch (error) {
        console.error(`[Enhance] ✗ Error uploading main image:`, error);
      }
    } else if (!article.imageUrl) {
      console.warn(`[Enhance] ⚠️ No image URL found for article`);
    } else {
      console.log(`[Enhance] ℹ️ Image already in Sanity CDN`);
    }

    // Upload all content images
    let contentImageMap = new Map<string, string>();
    if (uniqueImages.length > 0) {
      console.log(`[Enhance] Uploading ${uniqueImages.length} content images...`);
      contentImageMap = await uploadImagesToSanity(uniqueImages);
      console.log(`[Enhance] ✓ Uploaded ${contentImageMap.size} images`);
    }

    // Generate AI HTML
    console.log(`[Enhance] Generating AI HTML...`);
    const htmlGeneration = await generateStyledHtmlFromRSS(
      article.title,
      article.description || article.content.substring(0, 300),
      article.content,
      uniqueImages
    );

    let htmlContentAr = '';
    if (htmlGeneration.success) {
      htmlContentAr = htmlGeneration.translatedText;
      
      // Replace image URLs with Sanity CDN URLs
      if (contentImageMap.size > 0) {
        htmlContentAr = await replaceImageUrlsInHtml(htmlContentAr, contentImageMap);
      }
      
      console.log(`[Enhance] ✓ Generated AI HTML (${htmlContentAr.length} chars)`);
    }

    // Update article with enhancements
    const updateData: any = {
      htmlContentAr: htmlContentAr || article.content,
    };

    // Add image asset if uploaded
    if (sanityImageAssetId) {
      const { urlFor } = await import('@/sanity/lib/image');
      try {
        const sanityImage = {
          asset: {
            _ref: sanityImageAssetId,
            _type: 'reference' as const,
          },
        };
        updateData.image = sanityImage;
        updateData.imageUrl = urlFor(sanityImage).width(1600).height(900).url();
      } catch {
        updateData.imageUrl = getSanityImageUrl(sanityImageAssetId);
      }
    }

    await adminClient.patch(article._id).set(updateData).commit();
    
    console.log(`[Enhance] ✅ Enhanced successfully!`);

    // Count remaining articles
    const remaining = await adminClient.fetch<number>(
      `count(*[_type == "article" && (htmlContentAr == null || htmlContentAr == "")])`
    );

    return NextResponse.json({
      success: true,
      message: 'Enhanced 1 article',
      enhanced: 1,
      article: {
        id: article._id,
        title: article.title.substring(0, 60),
      },
      remaining,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('[Enhance] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Enhancement failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export const POST = GET;

