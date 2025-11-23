import { NextResponse } from 'next/server';
import { adminClient } from '@/sanity/lib/adminClient';
import { fetchRSSFeed, extractAllImages, extractPlainText } from '@/lib/rss-parser';
import { scrapeArticleContent } from '@/lib/article-scraper';
import { translateText, generateStyledHtmlFromRSS } from '@/lib/translator';
import { slugify, normalizeGuid } from '@/lib/utils';
import { uploadImagesToSanity, replaceImageUrlsInHtml } from '@/lib/sanity-image-upload';

/**
 * RESET AND SYNC ARTICLES
 * 
 * This endpoint:
 * 1. Deletes all existing articles
 * 2. Triggers the cron sync to repopulate with new AI-generated articles
 * 
 * Authentication: Requires CRON_SECRET
 */
export async function POST(request: Request) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized. This is a destructive operation.' },
        { status: 401 }
      );
    }

    console.log('[Reset and Sync] Starting reset and sync process...');

    // Step 1: Delete all articles
    console.log('[Reset and Sync] Step 1: Deleting all existing articles...');
    const allArticles = await adminClient.fetch<Array<{ _id: string }>>(
      `*[_type == "article"]{ _id }`
    );

    const articleIds = allArticles.map(article => article._id);
    const totalCount = articleIds.length;

    if (totalCount > 0) {
      const batchSize = 50;
      let deletedCount = 0;

      for (let i = 0; i < articleIds.length; i += batchSize) {
        const batch = articleIds.slice(i, i + batchSize);
        await Promise.all(batch.map(id => adminClient.delete(id)));
        deletedCount += batch.length;
        console.log(`[Reset and Sync] Deleted ${deletedCount}/${totalCount} articles...`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`[Reset and Sync] ✓ Deleted ${deletedCount} articles`);
    } else {
      console.log('[Reset and Sync] No articles to delete');
    }

    // Step 2: Run sync directly (same logic as cron endpoint)
    console.log('[Reset and Sync] Step 2: Starting article sync...');
    
    const targetImports = 20;
    const maxArticlesToProcess = 100;
    // Date filter: Only articles from the last 30 days (to avoid importing very old articles)
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - 30); // 30 days ago
    
    const results = {
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    };

    try {
      // Fetch articles from RSS
      const rssArticles = await fetchRSSFeed();
      console.log(`[Reset and Sync] Found ${rssArticles.length} articles in RSS feed`);

      // STEP 1: Deduplicate within RSS feed results (handle same article appearing multiple times)
      console.log(`[Reset and Sync] Deduplicating RSS feed results...`);
      const seenInFeed = new Map<string, typeof rssArticles[0]>();
      const deduplicatedRssArticles: typeof rssArticles = [];
      
      for (const article of rssArticles) {
        const guidKey = normalizeGuid(article.guid || article.url || article.id || '');
        const titleKey = article.title.trim().toLowerCase();
        
        // Check if we've already seen this article in the RSS feed (by GUID or title)
        if (guidKey && seenInFeed.has(guidKey)) {
          console.log(`[Reset and Sync] 🔄 Duplicate in RSS feed (GUID): ${article.title.substring(0, 50)}...`);
          continue;
        }
        if (seenInFeed.has(titleKey)) {
          console.log(`[Reset and Sync] 🔄 Duplicate in RSS feed (title): ${article.title.substring(0, 50)}...`);
          continue;
        }
        
        // Add to deduplicated list
        deduplicatedRssArticles.push(article);
        if (guidKey) seenInFeed.set(guidKey, article);
        seenInFeed.set(titleKey, article);
      }
      
      console.log(`[Reset and Sync] Deduplicated: ${rssArticles.length} → ${deduplicatedRssArticles.length} articles (removed ${rssArticles.length - deduplicatedRssArticles.length} duplicates)`);

      // STEP 2: Filter new articles by date
      const newArticles = deduplicatedRssArticles.filter(article => {
        const publishedDate = new Date(article.publishedAt);
        return !isNaN(publishedDate.getTime()) && publishedDate >= minDate;
      });

      console.log(`[Reset and Sync] ${newArticles.length} articles match date filter (Nov 1, 2025+)`);

      // Process articles until we reach target
      let processedCount = 0;
      for (const article of newArticles) {
        if (results.imported >= targetImports || processedCount >= maxArticlesToProcess) {
          break;
        }
        processedCount++;

        try {
          const slug = slugify(article.title);
          const guidKey = normalizeGuid(article.guid || article.url || article.id);

          // STEP 1: Scrape FULL article content from the actual article URL
          console.log(`[Reset and Sync] Scraping full article content from: ${article.url.substring(0, 80)}...`);
          let fullArticleContent = '';
          let fullArticleHtml = '';
          let scrapedImages: string[] = [];
          
          try {
            const scraped = await scrapeArticleContent(article.url);
            if (scraped.success && scraped.content) {
              fullArticleContent = scraped.content; // Full plain text content
              fullArticleHtml = scraped.htmlContent || ''; // Full HTML content
              console.log(`[Reset and Sync] ✓ Scraped full article content (${fullArticleContent.length} chars)`);
              
              // Extract images from scraped HTML content
              scrapedImages = extractAllImages(fullArticleHtml || fullArticleContent, article.url);
              console.log(`[Reset and Sync] Found ${scrapedImages.length} images in scraped content`);
            } else {
              console.warn(`[Reset and Sync] ⚠️  Scraping failed: ${scraped.error}, falling back to RSS content`);
            }
          } catch (scrapeError) {
            console.error(`[Reset and Sync] ✗ Error scraping article:`, scrapeError);
          }

          // STEP 2: Use scraped content if available, otherwise fall back to RSS content
          const rssContent = article.content || article.description || '';
          const contentToUse = fullArticleContent || rssContent;
          const htmlToUse = fullArticleHtml || rssContent;
          
          // Extract images from the content we'll use
          const allImages = extractAllImages(htmlToUse, article.url);
          // Combine scraped images with RSS images (remove duplicates)
          const uniqueImages = [...new Set([...scrapedImages, ...allImages])];
          
          // Extract plain text from the full content
          const plainText = fullArticleContent || extractPlainText(contentToUse);
          
          console.log(`[Reset and Sync] Using ${fullArticleContent ? 'SCRAPED' : 'RSS'} content (${plainText.length} chars)`);

          // Use main image from RSS feed or scraped content (REQUIRED - always upload)
          const originalImageUrl = article.urlToImage || (uniqueImages.length > 0 ? uniqueImages[0] : '');
          let imageUrl = originalImageUrl;
          let sanityImageAssetId: string | undefined;

          if (originalImageUrl) {
            console.log(`[Reset and Sync] Uploading main image to Sanity (required)...`);
            const uploadResult = await uploadImagesToSanity([originalImageUrl]);
            if (uploadResult.has(originalImageUrl)) {
              sanityImageAssetId = uploadResult.get(originalImageUrl);
              // Use Sanity image URL builder for proper URL
              const { urlFor } = await import('@/sanity/lib/image');
              try {
                const sanityImage = {
                  asset: {
                    _ref: sanityImageAssetId,
                    _type: 'reference' as const,
                  },
                };
                imageUrl = urlFor(sanityImage).width(1600).height(900).url() || originalImageUrl;
              } catch (error) {
                console.warn(`[Reset and Sync] Failed to generate Sanity URL, using asset ID format`);
                const { getSanityImageUrl } = await import('@/lib/sanity-image-upload');
                imageUrl = getSanityImageUrl(sanityImageAssetId!);
              }
              console.log(`[Reset and Sync] ✓ Main image uploaded to Sanity: ${sanityImageAssetId}`);
            } else {
              console.error(`[Reset and Sync] ✗ CRITICAL: Failed to upload main image! Using original URL as fallback`);
            }
          } else {
            console.warn(`[Reset and Sync] ⚠️  No main image found for article: ${article.title.substring(0, 50)}...`);
          }

          // Translate title and description
          const titleTranslation = await translateText(article.title, 'ar', 'en');
          const titleAr = titleTranslation.success ? titleTranslation.translatedText : article.title;

          // Use only the description for descriptionAr, not the full article content
          const descTranslation = await translateText(article.description || '', 'ar', 'en');
          const descriptionAr = descTranslation.success ? descTranslation.translatedText : (article.description || '');

          // Generate styled Arabic HTML using AI with FULL article content
          console.log(`[Reset and Sync] Generating styled Arabic HTML with AI (full article: ${plainText.length} chars)...`);
          let htmlContentAr = '';
          let contentAr = '';

          if (plainText && plainText.trim().length > 0) {
            // Use FULL article content, not just description or first 500 chars
            const htmlGeneration = await generateStyledHtmlFromRSS(
              article.title,
              article.description || plainText.substring(0, 300), // Description for context only
              plainText, // FULL article content - this is what gets rewritten
              uniqueImages // All images from both scraped and RSS content
            );

            if (htmlGeneration.success && htmlGeneration.translatedText) {
              htmlContentAr = htmlGeneration.translatedText;

              // Upload ALL content images and replace URLs with Sanity CDN URLs
              if (uniqueImages.length > 0) {
                console.log(`[Reset and Sync] Uploading ${uniqueImages.length} content images to Sanity...`);
                const imageMap = await uploadImagesToSanity(uniqueImages);
                console.log(`[Reset and Sync] ✓ Uploaded ${imageMap.size} images to Sanity`);
                
                htmlContentAr = await replaceImageUrlsInHtml(htmlContentAr, imageMap);
                console.log(`[Reset and Sync] ✓ Replaced ${imageMap.size} image URLs with Sanity CDN URLs`);
              }

              contentAr = htmlContentAr.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            } else {
              console.error(`[Reset and Sync] ✗ Failed to generate HTML: ${htmlGeneration.error}`);
              console.error(`[Reset and Sync] ✗ CRITICAL: Skipping article due to HTML generation failure`);
              results.failed++;
              results.errors.push(`Failed to generate HTML for: ${article.title.substring(0, 50)}`);
              continue; // Skip this article instead of using bad fallback
            }
          }

          const textContent = plainText || article.description || '';

          // Create article in Sanity
          const sanityArticle = {
            _type: 'article',
            title: article.title,
            titleAr: titleAr,
            slug: {
              _type: 'slug',
              current: slug,
            },
            description: article.description || textContent,
            descriptionAr: descriptionAr,
            content: textContent,
            contentAr: contentAr || descriptionAr,
            htmlContent: '',
            htmlContentAr: htmlContentAr || contentAr,
            imageUrl: imageUrl, // Sanity image URL or original URL (for fallback)
            image: sanityImageAssetId ? {
              _type: 'image',
              asset: {
                _type: 'reference',
                _ref: sanityImageAssetId,
              },
            } : undefined, // Sanity image asset reference (REQUIRED - main image always uploaded)
            publishedAt: article.publishedAt,
            sourceUrl: article.url,
            sourceName: article.source.name,
            rssGuid: guidKey,
            isPublished: true,
          };

          await adminClient.create(sanityArticle);
          console.log(`[Reset and Sync] ✓ Imported: ${titleAr.substring(0, 50)}... (${results.imported + 1}/${targetImports})`);
          results.imported++;

          if (results.imported >= targetImports) {
            console.log(`[Reset and Sync] ✓ Reached target of ${targetImports} imported articles`);
            break;
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`[Reset and Sync] ✗ Failed to import article:`, error);
          results.failed++;
          results.errors.push(`${article.title}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      console.log(`[Reset and Sync] ✓ Sync completed: ${results.imported} imported, ${results.skipped} skipped, ${results.failed} failed`);

      return NextResponse.json({
        success: true,
        message: 'Reset and sync completed successfully',
        deleted: totalCount,
        syncResults: {
          imported: results.imported,
          skipped: results.skipped,
          failed: results.failed,
          errors: results.errors.length > 0 ? results.errors : undefined,
        },
      });
    } catch (syncError) {
      console.error('[Reset and Sync] Sync error:', syncError);
      return NextResponse.json({
        success: true,
        message: `Successfully deleted ${totalCount} articles, but sync failed`,
        deleted: totalCount,
        syncError: syncError instanceof Error ? syncError.message : 'Unknown error',
        nextStep: 'Please manually trigger sync via GET /api/cron/sync-articles',
      });
    }
  } catch (error) {
    console.error('[Reset and Sync] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

