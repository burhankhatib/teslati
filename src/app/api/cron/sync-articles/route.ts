import { NextResponse } from 'next/server';
import { fetchRSSFeed, extractAllImages, extractPlainText } from '@/lib/rss-parser';
import { fetchWordPressArticles } from '@/lib/wordpress-fetcher';
import { scrapeArticleContent } from '@/lib/article-scraper';
import { translateText, generateStyledHtmlFromRSS } from '@/lib/translator';
import { adminClient } from '@/sanity/lib/adminClient';
import { slugify, normalizeGuid } from '@/lib/utils';
import { uploadImagesToSanity, replaceImageUrlsInHtml, getSanityImageUrl } from '@/lib/sanity-image-upload';

/**
 * Cron endpoint for automatic article syncing
 * 
 * SIMPLE RULE: Import all articles published on or after November 20, 2025
 * NO duplicate detection - let Sanity handle it naturally
 */
export async function GET(request: Request) {
  // Check if this is a Vercel Cron request (automatic)
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  
  // If not Vercel Cron, check for manual authentication
  if (!isVercelCron) {
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      const url = new URL(request.url);
      const querySecret = url.searchParams.get('secret');
      
      const isAuthorized = 
        authHeader === `Bearer ${cronSecret}` || 
        querySecret === cronSecret;
      
      if (!isAuthorized) {
        return NextResponse.json(
          { 
            error: 'Unauthorized',
            message: 'Please provide authentication'
          },
          { status: 401 }
        );
      }
    }
  }

  try {
    console.log('[Cron Sync] 🚀 Starting article sync...');
    console.log('[Cron Sync] Rule: Import articles published on or after November 20, 2025');

    // Fetch articles from all sources
    console.log('[Cron Sync] 📡 Fetching RSS feeds...');
    const rssArticles = await fetchRSSFeed();
    console.log(`[Cron Sync] Found ${rssArticles.length} RSS articles`);
    
    console.log('[Cron Sync] 📡 Fetching WordPress articles...');
    const wordpressArticles = await fetchWordPressArticles();
    console.log(`[Cron Sync] Found ${wordpressArticles.length} WordPress articles`);

    // Combine all articles
    const allArticles = [...rssArticles, ...wordpressArticles];
    console.log(`[Cron Sync] Total articles: ${allArticles.length}`);

    // Filter by date only - November 20, 2025 onwards
    const minDate = new Date('2025-11-20T00:00:00Z');
    console.log(`[Cron Sync] 📅 Date filter: ${minDate.toISOString()} onwards`);

    const validArticles: typeof allArticles = [];
    const tooOldArticles: typeof allArticles = [];

    for (const article of allArticles) {
      const publishedDate = new Date(article.publishedAt);
      
      // Check if date is valid
      if (isNaN(publishedDate.getTime())) {
        console.log(`[Cron Sync] ⚠️ Invalid date for: ${article.title.substring(0, 50)}`);
        continue;
      }

      // Check if article is from November 20, 2025 or later
      if (publishedDate >= minDate) {
        validArticles.push(article);
      } else {
        tooOldArticles.push(article);
      }
    }

    console.log(`[Cron Sync] ✅ Valid articles (Nov 20+): ${validArticles.length}`);
    console.log(`[Cron Sync] ⏭️ Too old articles: ${tooOldArticles.length}`);

    // Log by source
    const bySource = new Map<string, number>();
    for (const article of validArticles) {
      const source = article.source?.name || 'Unknown';
      bySource.set(source, (bySource.get(source) || 0) + 1);
    }
    console.log('[Cron Sync] 📊 Valid articles by source:');
    for (const [source, count] of bySource) {
      console.log(`[Cron Sync]   - ${source}: ${count} articles`);
    }

    if (validArticles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No articles to import (all too old)',
        imported: 0,
        failed: 0,
        skipped: tooOldArticles.length,
        timestamp: new Date().toISOString(),
      });
    }

    // Process articles - import up to 20 at a time
    const results = {
      imported: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    const targetImports = 20;
    const articlesToProcess = validArticles.slice(0, Math.min(targetImports, validArticles.length));
    
    console.log(`[Cron Sync] 🔄 Processing ${articlesToProcess.length} articles...`);

    for (let i = 0; i < articlesToProcess.length; i++) {
      const article = articlesToProcess[i];
      
      try {
        console.log(`[Cron Sync] [${i + 1}/${articlesToProcess.length}] Processing: ${article.title.substring(0, 50)}...`);

        // Generate slug
        const slug = slugify(article.title);

        // STEP 1: Scrape full article content
        let fullArticleContent = '';
        let fullArticleHtml = '';
        let scrapedImages: string[] = [];
        
        try {
          const scraped = await scrapeArticleContent(article.url);
          if (scraped.success && scraped.content) {
            fullArticleContent = scraped.content;
            fullArticleHtml = scraped.htmlContent || '';
            scrapedImages = extractAllImages(fullArticleHtml || fullArticleContent, article.url);
            console.log(`[Cron Sync]   ✓ Scraped content (${fullArticleContent.length} chars, ${scrapedImages.length} images)`);
          }
        } catch (scrapeError) {
          console.error(`[Cron Sync]   ⚠️ Scraping failed:`, scrapeError);
        }

        // STEP 2: Use scraped content or fall back to RSS
        const rssContent = article.content || article.description || '';
        const contentToUse = fullArticleContent || rssContent;
        const htmlToUse = fullArticleHtml || rssContent;
        
        const allImages = extractAllImages(htmlToUse, article.url);
        const uniqueImages = [...new Set([...scrapedImages, ...allImages])];
        const plainText = fullArticleContent || extractPlainText(contentToUse);
        
        console.log(`[Cron Sync]   Using ${fullArticleContent ? 'SCRAPED' : 'RSS'} content (${plainText.length} chars, ${uniqueImages.length} images)`);

        // STEP 3: Upload main image to Sanity
        const originalImageUrl = article.urlToImage || (uniqueImages.length > 0 ? uniqueImages[0] : null);
        let imageUrl = originalImageUrl;
        let sanityImageAssetId: string | null = null;
        
        if (originalImageUrl) {
          const imageMap = await uploadImagesToSanity([originalImageUrl]);
          const uploadedAssetId = imageMap.get(originalImageUrl);
          if (uploadedAssetId) {
            sanityImageAssetId = uploadedAssetId;
            const { urlFor } = await import('@/sanity/lib/image');
            try {
              const sanityImage = {
                asset: {
                  _ref: uploadedAssetId,
                  _type: 'reference' as const,
                },
              };
              imageUrl = urlFor(sanityImage).width(1600).height(900).url() || originalImageUrl;
            } catch {
              imageUrl = getSanityImageUrl(uploadedAssetId);
            }
            console.log(`[Cron Sync]   ✓ Main image uploaded`);
          }
        }

        // STEP 4: Upload all content images
        let contentImageMap = new Map<string, string>();
        if (uniqueImages.length > 0) {
          contentImageMap = await uploadImagesToSanity(uniqueImages);
          console.log(`[Cron Sync]   ✓ Uploaded ${contentImageMap.size} content images`);
        }

        // STEP 5: Translate to Arabic
        console.log(`[Cron Sync]   🌐 Translating to Arabic...`);
        const titleTranslation = await translateText(article.title, 'ar', 'en');
        const titleAr = titleTranslation.success ? titleTranslation.translatedText : article.title;

        const descTranslation = await translateText(article.description || '', 'ar', 'en');
        const descriptionAr = descTranslation.success ? descTranslation.translatedText : (article.description || '');

        // STEP 6: Generate styled Arabic HTML
        let htmlContentAr = '';
        let contentAr = '';

        if (plainText && plainText.trim().length > 0) {
          const htmlGeneration = await generateStyledHtmlFromRSS(
            article.title,
            article.description || plainText.substring(0, 300),
            plainText,
            uniqueImages
          );
          
          if (htmlGeneration.success) {
            htmlContentAr = htmlGeneration.translatedText;
            
            if (contentImageMap.size > 0) {
              htmlContentAr = await replaceImageUrlsInHtml(htmlContentAr, contentImageMap);
            }
            
            contentAr = htmlContentAr.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            console.log(`[Cron Sync]   ✓ Generated Arabic HTML (${htmlContentAr.length} chars)`);
          } else {
            console.error(`[Cron Sync]   ✗ Failed to generate HTML - SKIPPING`);
            results.failed++;
            results.errors.push(`Failed to generate HTML for: ${article.title.substring(0, 50)}`);
            continue;
          }
        }

        const textContent = plainText || article.description || '';

        // STEP 7: Create article in Sanity
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
          imageUrl: imageUrl,
          image: sanityImageAssetId ? {
            _type: 'image',
            asset: {
              _type: 'reference',
              _ref: sanityImageAssetId,
            },
          } : undefined,
          publishedAt: article.publishedAt,
          sourceUrl: article.url,
          sourceName: article.source.name,
          rssGuid: normalizeGuid(article.guid || article.url || article.id || ''),
          isPublished: true,
        };

        await adminClient.create(sanityArticle);
        results.imported++;
        console.log(`[Cron Sync]   ✅ Imported (${results.imported}/${targetImports}): ${titleAr.substring(0, 50)}...`);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`[Cron Sync]   ✗ Failed to import:`, error);
        results.failed++;
        results.errors.push(`${article.title}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`[Cron Sync] 🎉 Complete! Imported: ${results.imported}, Failed: ${results.failed}`);

    return NextResponse.json({
      success: true,
      message: `Imported ${results.imported} articles, ${results.failed} failed`,
      imported: results.imported,
      failed: results.failed,
      skipped: tooOldArticles.length,
      processed: results.imported + results.failed,
      remaining: validArticles.length - results.imported - results.failed,
      errors: results.errors,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('[Cron Sync] ❌ Sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync articles',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export const POST = GET;
