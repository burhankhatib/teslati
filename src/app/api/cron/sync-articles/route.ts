import { NextResponse } from 'next/server';
import { fetchRSSFeed, extractAllImages, extractPlainText } from '@/lib/rss-parser';
import { fetchWordPressArticles } from '@/lib/wordpress-fetcher';
import { translateText } from '@/lib/translator';
import { adminClient } from '@/sanity/lib/adminClient';
import { slugify, normalizeGuid } from '@/lib/utils';
import { uploadImageToSanity } from '@/lib/sanity-image-upload';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .filter(paragraph => paragraph.length > 0);
}

function generateBasicHtml(options: {
  title: string;
  content: string;
  images: string[];
  lang: 'en' | 'ar';
}): string {
  const { title, content, images, lang } = options;
  const paragraphs = splitIntoParagraphs(content);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const languageAttr = lang === 'ar' ? 'ar' : 'en';
  const escapedTitle = escapeHtml(title);

  const paragraphHtml =
    paragraphs.length > 0
      ? paragraphs
          .map(paragraph => `<p class="leading-relaxed mb-4">${escapeHtml(paragraph)}</p>`)
          .join('\n')
      : `<p class="leading-relaxed mb-4">${escapeHtml(content)}</p>`;

  const imageSection =
    images && images.length > 0
      ? `<figure class="my-6">
  <img src="${images[0]}" alt="${escapedTitle}" class="w-full rounded-xl shadow-md object-cover" loading="lazy" />
</figure>`
      : '';

  return `<article dir="${dir}" lang="${languageAttr}" class="prose prose-neutral max-w-none text-base sm:text-lg">
  <header class="mb-6">
    <h1 class="text-3xl sm:text-4xl font-bold mb-4">${escapedTitle}</h1>
  </header>
  ${imageSection}
  <section class="space-y-4">
    ${paragraphHtml}
  </section>
</article>`;
}

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

    // STEP 2: Check for duplicates in Sanity
    console.log(`[Cron Sync] 🔍 Checking for duplicates in Sanity...`);
    const existingArticles = await adminClient.fetch<
      Array<{ slug: string; sourceUrl: string; title: string }>
    >(
      `*[_type == "article"]{ 
        "slug": slug.current, 
        sourceUrl,
        title
      }`
    );

    // Create Sets for fast duplicate checking
    const existingSlugs = new Set(existingArticles.map(a => a.slug?.toLowerCase() || ''));
    const existingUrls = new Set(existingArticles.map(a => a.sourceUrl));
    const existingTitles = new Set(existingArticles.map(a => a.title?.toLowerCase().trim() || ''));
    
    console.log(`[Cron Sync] Found ${existingArticles.length} existing articles in Sanity`);

    // STEP 3: Filter out duplicates
    const newArticles: typeof validArticles = [];
    const duplicateArticles: typeof validArticles = [];

    for (const article of validArticles) {
      const slug = slugify(article.title).toLowerCase();
      const url = article.url;
      const title = article.title.toLowerCase().trim();

      // Check if article already exists (by slug, URL, or title)
      const isDuplicate = 
        existingSlugs.has(slug) || 
        existingUrls.has(url) || 
        existingTitles.has(title);

      if (isDuplicate) {
        duplicateArticles.push(article);
      } else {
        newArticles.push(article);
      }
    }

    console.log(`[Cron Sync] 📊 After duplicate check:`);
    console.log(`[Cron Sync]   ✅ New articles: ${newArticles.length}`);
    console.log(`[Cron Sync]   🔄 Duplicates: ${duplicateArticles.length}`);

    // Log by source
    const bySource = new Map<string, number>();
    for (const article of newArticles) {
      const source = article.source?.name || 'Unknown';
      bySource.set(source, (bySource.get(source) || 0) + 1);
    }
    console.log('[Cron Sync] 📊 New articles by source:');
    for (const [source, count] of bySource) {
      console.log(`[Cron Sync]   - ${source}: ${count} articles`);
    }

    if (newArticles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new articles to import (all duplicates or too old)',
        imported: 0,
        failed: 0,
        skipped: tooOldArticles.length,
        duplicates: duplicateArticles.length,
        timestamp: new Date().toISOString(),
      });
    }

    // Process articles - import ONLY 1 article per run (with full AI translation + images)
    const results = {
      imported: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    const targetImports = 1; // ONE article with full processing to avoid timeout
    const articlesToProcess = newArticles.slice(0, Math.min(targetImports, newArticles.length));
    
    console.log(`[Cron Sync] 🔄 Processing ${articlesToProcess.length} article(s)...`);
    console.log(`[Cron Sync] Mode: Full processing (Translation + AI + Images, NO scraping)`);

    for (let i = 0; i < articlesToProcess.length; i++) {
      const article = articlesToProcess[i];
      const startTime = Date.now();
      
      try {
        console.log(`[Cron Sync] [${i + 1}/${articlesToProcess.length}] Processing: ${article.title.substring(0, 50)}...`);
        console.log(`[Cron Sync]   Source: ${article.source.name}`);
        console.log(`[Cron Sync]   Published: ${article.publishedAt}`);

        // Generate slug
        const slug = slugify(article.title);

        // STEP 1: Skip scraping for speed (use RSS content only)
        // Scraping adds 10-30 seconds per article, causing timeout
        const fullArticleContent = article.content || article.description || '';
        const fullArticleHtml = article.content || article.description || '';
        const scrapedImages: string[] = [];
        
        // Skip scraping to avoid timeout - use RSS content directly
        console.log(`[Cron Sync]   ⚡ Using RSS content (skipping scraping for speed)`);

        // STEP 2: Use scraped content or fall back to RSS
        const rssContent = article.content || article.description || '';
        const contentToUse = fullArticleContent || rssContent;
        const htmlToUse = fullArticleHtml || rssContent;
        
        const allImages = extractAllImages(htmlToUse, article.url);
        const uniqueImages = [...new Set([...scrapedImages, ...allImages])];
        const plainText = fullArticleContent || extractPlainText(contentToUse);
        
        console.log(`[Cron Sync]   Using ${fullArticleContent ? 'SCRAPED' : 'RSS'} content (${plainText.length} chars, ${uniqueImages.length} images)`);

        // STEP 3: Handle main image (upload to Sanity for high-priority sources)
        const originalImageUrl = article.urlToImage || (uniqueImages.length > 0 ? uniqueImages[0] : null);
        let imageUrl = originalImageUrl;
        let sanityImageAssetId: string | null = null;
        const shouldUploadImage =
          !!originalImageUrl &&
          (article.source?.name === 'TESLARATI' || article.source?.name === 'Not a Tesla App');
        
        if (originalImageUrl) {
          console.log(`[Cron Sync]   📸 Image found: ${originalImageUrl.substring(0, 120)}...`);
          
          if (shouldUploadImage) {
            console.log(`[Cron Sync]   ⬆️ Uploading image to Sanity (${article.source.name})...`);
            const uploadResult = await uploadImageToSanity(originalImageUrl);
            if (uploadResult.sanityAssetId) {
              sanityImageAssetId = uploadResult.sanityAssetId;
              try {
                const { urlFor } = await import('@/sanity/lib/image');
                const sanityImage = {
                  asset: {
                    _ref: sanityImageAssetId,
                    _type: 'reference' as const,
                  },
                };
                imageUrl = urlFor(sanityImage).width(1600).height(900).url() || originalImageUrl;
                console.log(`[Cron Sync]   ✅ Image uploaded to Sanity: ${sanityImageAssetId}`);
              } catch (error) {
                console.error('[Cron Sync]   ⚠️ Failed to build Sanity image URL, using fallback', error);
                imageUrl = originalImageUrl;
              }
            } else {
              console.warn('[Cron Sync]   ⚠️ Sanity upload failed, using original URL');
            }
          } else {
            console.log(`[Cron Sync]   ⚡ Skipping upload for source ${article.source.name}`);
          }
        } else {
          console.warn(`[Cron Sync]   ⚠️ No image found for article from ${article.source.name}`);
        }

        // STEP 4: Translate title and description
        console.log(`[Cron Sync]   🌐 Translating to Arabic (parallel)...`);
        const [titleTranslation, descTranslation] = await Promise.all([
          translateText(article.title, 'ar', 'en'),
          translateText(article.description || '', 'ar', 'en'),
        ]);
        const titleAr = titleTranslation.success ? titleTranslation.translatedText : article.title;
        const descriptionAr = descTranslation.success ? descTranslation.translatedText : (article.description || '');

        // STEP 5: Generate lightweight HTML content
        console.log(`[Cron Sync]   🎨 Generating lightweight HTML content...`);
        const textContent = plainText || article.description || '';
        const contentAr = descriptionAr || article.description || '';
        const htmlContent = generateBasicHtml({
          title: article.title,
          content: textContent,
          images: uniqueImages.slice(0, 3),
          lang: 'en',
        });
        const htmlContentAr = generateBasicHtml({
          title: titleAr,
          content: contentAr,
          images: uniqueImages.slice(0, 3),
          lang: 'ar',
        });
        console.log(`[Cron Sync]   ✓ HTML generated (EN ${htmlContent.length} chars | AR ${htmlContentAr.length} chars)`);

        // STEP 6: Create article in Sanity
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
          htmlContent,
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
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[Cron Sync]   ✅ Imported in ${elapsed}s (${results.imported}/${targetImports}): ${titleAr.substring(0, 50)}...`);
        
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
      duplicates: duplicateArticles.length,
      processed: results.imported + results.failed,
      remaining: newArticles.length - results.imported - results.failed,
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
