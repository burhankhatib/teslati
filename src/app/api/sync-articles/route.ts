import { NextResponse } from 'next/server';
import { fetchRSSFeed, extractAllImages, extractPlainText } from '@/lib/rss-parser';
import { scrapeArticleContent } from '@/lib/article-scraper';
import { translateText, generateStyledHtmlFromRSS } from '@/lib/translator';
import { adminClient } from '@/sanity/lib/adminClient';
import { slugify, replaceReferralLinks, normalizeGuid } from '@/lib/utils';
import { uploadImagesToSanity, replaceImageUrlsInHtml, getSanityImageUrl } from '@/lib/sanity-image-upload';

interface RSSArticle {
  id: string;
  slug: string;
  title: string;
  description: string;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string;
}

/**
 * Sync articles from RSS feed to Sanity
 * - Fetches RSS feed
 * - Checks for new articles (by RSS GUID)
 * - Translates to Arabic using OpenAI
 * - Imports to Sanity
 */
export async function POST(request: Request) {
  try {
    console.log('[Sync Articles] Starting sync process...');

    // Fetch articles from RSS
    const rssArticles = await fetchRSSFeed();
    console.log(`[Sync Articles] Found ${rssArticles.length} articles in RSS feed`);

    // STEP 1: Deduplicate within RSS feed results (handle same article appearing multiple times)
    console.log(`[Sync Articles] Deduplicating RSS feed results...`);
    const seenInFeed = new Map<string, typeof rssArticles[0]>();
    const deduplicatedRssArticles: typeof rssArticles = [];
    
    for (const article of rssArticles) {
      const guidKey = normalizeGuid(article.guid || article.url || article.id || '');
      const titleKey = article.title.trim().toLowerCase();
      
      // Check if we've already seen this article in the RSS feed (by GUID or title)
      if (guidKey && seenInFeed.has(guidKey)) {
        console.log(`[Sync Articles] 🔄 Duplicate in RSS feed (GUID): ${article.title.substring(0, 50)}...`);
        continue;
      }
      if (seenInFeed.has(titleKey)) {
        console.log(`[Sync Articles] 🔄 Duplicate in RSS feed (title): ${article.title.substring(0, 50)}...`);
        continue;
      }
      
      // Add to deduplicated list
      deduplicatedRssArticles.push(article);
      if (guidKey) seenInFeed.set(guidKey, article);
      seenInFeed.set(titleKey, article);
    }
    
    console.log(`[Sync Articles] Deduplicated: ${rssArticles.length} → ${deduplicatedRssArticles.length} articles (removed ${rssArticles.length - deduplicatedRssArticles.length} duplicates)`);

    // Date filter: Only articles published from November 21, 2025 onwards
    const minDate = new Date('2025-11-21T00:00:00Z'); // November 21, 2025 at 00:00:00 UTC
    console.log(`[Sync Articles] Date filter: Only articles from ${minDate.toISOString()} onwards (November 21, 2025)`);

    // Get existing articles from Sanity to check for duplicates by publishedAt (exact match)
    const existingArticles = await adminClient.fetch<
      Array<{ publishedAt: string }>
    >(
      `*[_type == "article"]{ publishedAt }`
    );
    
    // Create a Set of publishedAt values for duplicate detection (exact match)
    const existingPublishedDates = new Set<string>();
    for (const article of existingArticles) {
      if (article.publishedAt) {
        existingPublishedDates.add(article.publishedAt);
      }
    }
    console.log(`[Sync Articles] Found ${existingArticles.length} existing articles in Sanity`);

    // STEP 2: Filter new articles - skip if already exists or too old
    const newArticles: typeof rssArticles = [];
    const skippedArticles: Array<{ title: string; reason: string }> = [];

    for (const article of deduplicatedRssArticles) {
      // Check if article is too old (before today 8 AM)
      const publishedDate = new Date(article.publishedAt);
      if (isNaN(publishedDate.getTime()) || publishedDate < minDate) {
        const hoursDiff = Math.floor((new Date().getTime() - publishedDate.getTime()) / (1000 * 60 * 60));
        skippedArticles.push({ 
          title: article.title, 
          reason: `Too old (published: ${publishedDate.toISOString()}, before today 8 AM, ${hoursDiff} hours ago)` 
        });
        console.log(`[Sync Articles] ⏭️  Skipping old article: ${article.title.substring(0, 50)}... (published: ${publishedDate.toISOString()}, ${hoursDiff} hours ago)`);
        continue;
      }
      // Simple duplicate detection: check if publishedAt exists exactly in Sanity
      const articlePublishedAt = article.publishedAt;
      
      if (existingPublishedDates.has(articlePublishedAt)) {
        skippedArticles.push({ 
          title: article.title, 
          reason: `Already exists (publishedAt: ${articlePublishedAt})` 
        });
        console.log(`[Sync Articles] ⏭️  Skipping existing article: ${article.title.substring(0, 50)}... (publishedAt: ${articlePublishedAt})`);
        continue;
      }
      
      newArticles.push(article);
      existingPublishedDates.add(articlePublishedAt);
    }

    console.log(`[Sync Articles] Found ${newArticles.length} new articles to import, ${skippedArticles.length} skipped`);

    if (newArticles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new articles to import',
        imported: 0,
        skipped: rssArticles.length,
      });
    }

    // Process and import new articles
    const results = {
      imported: 0,
      failed: 0,
      skipped: skippedArticles.length,
      errors: [] as string[],
    };

    for (const article of newArticles.slice(0, 20)) { // Limit to 20 at a time
      try {
        // Double-check article doesn't exist (defensive check)
        // Use GUID if available (from RSS feed), otherwise use URL
        const guid = normalizeGuid(article.guid || article.url || article.id || '');
        const slug = slugify(article.title);
        const checkExisting = await adminClient.fetch<Array<{ rssGuid: string; slug: { current: string } }>>(
          `*[_type == "article" && (rssGuid == $guid || slug.current == $slug)]{ rssGuid, "slug": slug.current }`,
          { guid, slug }
        );
        
        if (checkExisting.length > 0) {
          console.log(`[Sync Articles] ⏭️  Skipping - article already exists: ${article.title.substring(0, 50)}...`);
          results.skipped++;
          continue;
        }

        console.log(`[Sync Articles] Processing: ${article.title.substring(0, 50)}...`);

        // STEP 1: Scrape FULL article content from the actual article URL
        console.log(`[Sync Articles] Scraping full article content from: ${article.url.substring(0, 80)}...`);
        let fullArticleContent = '';
        let fullArticleHtml = '';
        let scrapedImages: string[] = [];
        
        try {
          const scraped = await scrapeArticleContent(article.url);
          if (scraped.success && scraped.content) {
            fullArticleContent = scraped.content; // Full plain text content
            fullArticleHtml = scraped.htmlContent || ''; // Full HTML content
            console.log(`[Sync Articles] ✓ Scraped full article content (${fullArticleContent.length} chars)`);
            
            // Extract images from scraped HTML content (pass article URL as base for relative URLs)
            scrapedImages = extractAllImages(fullArticleHtml || fullArticleContent, article.url);
            console.log(`[Sync Articles] Found ${scrapedImages.length} images in scraped content`);
          } else {
            console.warn(`[Sync Articles] ⚠️  Scraping failed: ${scraped.error}, falling back to RSS content`);
          }
        } catch (scrapeError) {
          console.error(`[Sync Articles] ✗ Error scraping article:`, scrapeError);
        }

        // STEP 2: Use scraped content if available, otherwise fall back to RSS content
        const rssContent = article.content || article.description || '';
        const contentToUse = fullArticleContent || rssContent;
        const htmlToUse = fullArticleHtml || rssContent;
        
        // Extract images from the content we'll use (pass article URL as base for relative URLs)
        const allImages = extractAllImages(htmlToUse, article.url);
        // Combine scraped images with RSS images (remove duplicates)
        const uniqueImages = [...new Set([...scrapedImages, ...allImages])];
        console.log(`[Sync Articles] Total unique images found: ${uniqueImages.length} (${scrapedImages.length} scraped + ${allImages.length} from RSS)`);
        
        // Extract plain text from the full content
        const plainText = fullArticleContent || extractPlainText(contentToUse);
        
        console.log(`[Sync Articles] Using ${fullArticleContent ? 'SCRAPED' : 'RSS'} content (${plainText.length} chars)`);
        
        // Use main image from RSS feed or scraped content
        const originalImageUrl = article.urlToImage || (uniqueImages.length > 0 ? uniqueImages[0] : null);
        if (originalImageUrl) {
          console.log(`[Sync Articles] Image URL: ${originalImageUrl.substring(0, 80)}...`);
        } else {
          console.warn(`[Sync Articles] ⚠️  No image found for article: ${article.title.substring(0, 50)}...`);
        }

        // Upload main image to Sanity (REQUIRED - always upload main image)
        let imageUrl = originalImageUrl; // Fallback to original URL if upload fails
        let sanityImageAssetId: string | null = null;
        if (originalImageUrl) {
          console.log(`[Sync Articles] Uploading main image to Sanity (required)...`);
          const imageMap = await uploadImagesToSanity([originalImageUrl]);
          const uploadedAssetId = imageMap.get(originalImageUrl);
          if (uploadedAssetId) {
            sanityImageAssetId = uploadedAssetId;
            // Use Sanity image URL builder for proper URL
            const { urlFor } = await import('@/sanity/lib/image');
            try {
              const sanityImage = {
                asset: {
                  _ref: uploadedAssetId,
                  _type: 'reference' as const,
                },
              };
              imageUrl = urlFor(sanityImage).width(1600).height(900).url() || originalImageUrl;
            } catch (error) {
              console.warn(`[Sync Articles] Failed to generate Sanity URL, using asset ID format`);
              imageUrl = getSanityImageUrl(uploadedAssetId);
            }
            console.log(`[Sync Articles] ✓ Main image uploaded to Sanity: ${uploadedAssetId}`);
          } else {
            console.error(`[Sync Articles] ✗ CRITICAL: Failed to upload main image! Using original URL as fallback`);
          }
        } else {
          console.warn(`[Sync Articles] ⚠️  No main image found for article: ${article.title.substring(0, 50)}...`);
        }

        // Upload all content images to Sanity (from both scraped and RSS content)
        let imageMap = new Map<string, string>();
        if (uniqueImages.length > 0) {
          console.log(`[Sync Articles] Uploading ${uniqueImages.length} content images to Sanity...`);
          imageMap = await uploadImagesToSanity(uniqueImages);
          console.log(`[Sync Articles] ✓ Uploaded ${imageMap.size} images to Sanity`);
        }

        // Translate title and description to Arabic
        console.log(`[Sync Articles] Translating title to Arabic...`);
        const titleTranslation = await translateText(article.title, 'ar', 'en');
        const titleAr = titleTranslation.success ? titleTranslation.translatedText : article.title;

        console.log(`[Sync Articles] Translating description to Arabic...`);
        // Use only the description for descriptionAr, not the full article content
        const descTranslation = await translateText(article.description || '', 'ar', 'en');
        const descriptionAr = descTranslation.success ? descTranslation.translatedText : (article.description || '');

        // Generate styled Arabic HTML using AI with FULL article content
        console.log(`[Sync Articles] Generating styled Arabic HTML with AI (full article: ${plainText.length} chars)...`);
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
          
          if (htmlGeneration.success) {
            htmlContentAr = htmlGeneration.translatedText;
            
            // Replace image URLs in HTML with Sanity CDN URLs
            if (imageMap.size > 0) {
              htmlContentAr = await replaceImageUrlsInHtml(htmlContentAr, imageMap);
              console.log(`[Sync Articles] ✓ Replaced ${imageMap.size} image URLs with Sanity CDN URLs`);
            }
            
            // Extract plain text from generated HTML for contentAr
            contentAr = htmlContentAr.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            console.log(`[Sync Articles] ✓ Generated styled HTML (${htmlContentAr.length} chars)`);
          } else {
            console.error(`[Sync Articles] ✗ Failed to generate HTML: ${htmlGeneration.error}`);
            console.error(`[Sync Articles] ✗ CRITICAL: Skipping article due to HTML generation failure`);
            results.failed++;
            results.errors.push(`Failed to generate HTML for: ${article.title.substring(0, 50)}`);
            continue; // Skip this article instead of using bad fallback
          }
        }

        // Keep English content as plain text (no HTML generation for English to save tokens)
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
          content: textContent, // English plain text
          contentAr: contentAr || descriptionAr, // Arabic plain text
          htmlContent: '', // No English HTML (save tokens)
          htmlContentAr: htmlContentAr || contentAr, // AI-generated styled Arabic HTML
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
          sourceName: article.source.name, // Use source name from RSS feed
          rssGuid: normalizeGuid(article.guid || article.url || article.id || ''), // Normalize GUID for consistent duplicate detection
          isPublished: true,
        };

        await adminClient.create(sanityArticle);
        console.log(`[Sync Articles] ✓ Imported: ${titleAr.substring(0, 50)}...`);
        results.imported++;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[Sync Articles] ✗ Failed to import article:`, error);
        results.failed++;
        results.errors.push(`${article.title}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Imported ${results.imported} articles, ${results.failed} failed, ${results.skipped} skipped`,
      imported: results.imported,
      failed: results.failed,
      skipped: results.skipped + skippedArticles.length,
      skippedDetails: skippedArticles,
      errors: results.errors,
    });
  } catch (error) {
    console.error('[Sync Articles] Sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync articles',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check sync status
 */
export async function GET() {
  try {
    const rssArticles = await fetchRSSFeed();
    const sanityArticles = await adminClient.fetch<Array<{ rssGuid?: string }>>(
      `*[_type == "article"]{ rssGuid }`
    );

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const existingGuids = new Set(
      sanityArticles
        .map((article) => normalizeGuid(article.rssGuid || ''))
        .filter(Boolean)
    );
    const newArticles = rssArticles.filter(article => {
      // Use GUID if available (from RSS feed), otherwise use URL
      const guid = normalizeGuid(article.guid || article.url || article.id || '');
      const publishedDate = new Date(article.publishedAt);
      return (!existingGuids.has(guid)) && !isNaN(publishedDate.getTime()) && publishedDate >= todayStart;
    });

    return NextResponse.json({
      rssTotal: rssArticles.length,
      sanityTotal: sanityArticles.length,
      newArticles: newArticles.length,
      newArticlesList: newArticles.slice(0, 10).map(a => ({
        title: a.title,
        url: a.url,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to check sync status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

