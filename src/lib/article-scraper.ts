/**
 * Scrapes article content from Not a Tesla App pages
 */

import { replaceReferralLinks } from './utils';

export interface ScrapedContent {
  content: string;
  htmlContent: string;
  success: boolean;
  error?: string;
  mainImage?: string; // Main image URL extracted from scraped content
}

/**
 * Extract main article content from HTML
 */
function extractArticleContent(html: string, url: string): string {
  try {
    // Try to find article content in common containers
    // Not a Tesla App likely uses article tags or specific divs
    
    // Pattern 1: Look for <article> tag
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      return articleMatch[1];
    }
    
    // Pattern 2: Look for main content divs (common patterns)
    const mainContentPatterns = [
      /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*post[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*id="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*id="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    ];
    
    for (const pattern of mainContentPatterns) {
      const match = html.match(pattern);
      if (match && match[1].length > 500) { // Ensure substantial content
        return match[1];
      }
    }
    
    // Pattern 3: Look for <main> tag
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (mainMatch) {
      return mainMatch[1];
    }
    
    // Fallback: Extract content between body tags, excluding common non-content elements
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      let bodyContent = bodyMatch[1];
      // Remove common non-content elements
      bodyContent = bodyContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      bodyContent = bodyContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      bodyContent = bodyContent.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
      bodyContent = bodyContent.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
      bodyContent = bodyContent.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
      bodyContent = bodyContent.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');
      return bodyContent;
    }
    
    return '';
  } catch (error) {
    console.error('Error extracting content:', error);
    return '';
  }
}

/**
 * Check if URL is from Teslarati
 */
function isTeslaratiUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('teslarati.com');
  } catch {
    return false;
  }
}

/**
 * Clean HTML content - remove scripts, styles, and sanitize
 * Also removes: duplicate titles/images, Not a Tesla App links, image captions, social media divs
 * For Teslarati: removes ads, all links (except bottom reference), author divs, comments/social media
 */
function cleanHtmlContent(html: string, url: string): string {
  const isTeslarati = isTeslaratiUrl(url);
  let cleaned = html;
  
  // Remove script tags
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  
  // Remove style tags
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remove comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  
  // Remove common non-content elements
  cleaned = cleaned.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  cleaned = cleaned.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  cleaned = cleaned.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  cleaned = cleaned.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');
  
  // Remove iframes
  cleaned = cleaned.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
  
  // Remove forms
  cleaned = cleaned.replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '');
  
  // TESLARATI-SPECIFIC CLEANING
  if (isTeslarati) {
    // 1. Remove advertisement divs
    cleaned = cleaned.replace(/<div[^>]*(ad|advertisement|ads|advert|sponsor|promo|banner|google-ad|ad-container|ad-wrapper|ad-box|ad-unit|ad-slot|ad-placeholder|ad-label|ad-text)[^>]*>[\s\S]*?<\/div>/gi, '');
    cleaned = cleaned.replace(/<section[^>]*(ad|advertisement|ads|advert|sponsor|promo|banner|google-ad|ad-container|ad-wrapper|ad-box|ad-unit|ad-slot|ad-placeholder|ad-label|ad-text)[^>]*>[\s\S]*?<\/section>/gi, '');
    cleaned = cleaned.replace(/<aside[^>]*(ad|advertisement|ads|advert|sponsor|promo|banner|google-ad)[^>]*>[\s\S]*?<\/aside>/gi, '');
    
    // 2. Remove social media links divs (X/Twitter, Facebook, etc.)
    cleaned = cleaned.replace(/<div[^>]*(social|share|facebook|twitter|instagram|tiktok|youtube|threads|linkedin|pinterest|reddit|snapchat|whatsapp|telegram|x\.com|tweet|share-button|share-buttons|social-share|social-media)[^>]*>[\s\S]*?<\/div>/gi, '');
    cleaned = cleaned.replace(/<section[^>]*(social|share|facebook|twitter|instagram|tiktok|youtube|threads|linkedin|pinterest|reddit|snapchat|whatsapp|telegram|x\.com|tweet|share-button|share-buttons|social-share|social-media)[^>]*>[\s\S]*?<\/section>/gi, '');
    cleaned = cleaned.replace(/<ul[^>]*(social|share|facebook|twitter|instagram|tiktok|youtube|threads|linkedin|pinterest|reddit|snapchat|whatsapp|telegram|x\.com|tweet|share-button|share-buttons)[^>]*>[\s\S]*?<\/ul>/gi, '');
    cleaned = cleaned.replace(/<div[^>]*id="[^"]*(social|share|facebook|twitter|instagram|tiktok|youtube|threads|linkedin|pinterest|reddit|snapchat|whatsapp|telegram|x\.com|tweet|share-button|share-buttons|social-share|social-media)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    
    // Remove Share/Tweet specific divs and buttons
    cleaned = cleaned.replace(/<div[^>]*(share|tweet|share-this|share-post|share-article)[^>]*>[\s\S]*?<\/div>/gi, '');
    cleaned = cleaned.replace(/<button[^>]*(share|tweet|facebook|twitter|x\.com)[^>]*>[\s\S]*?<\/button>/gi, '');
    cleaned = cleaned.replace(/<a[^>]*(share|tweet|facebook|twitter|x\.com|share-button)[^>]*>[\s\S]*?<\/a>/gi, '');
    
    // 3. Remove author info divs (comprehensive)
    cleaned = cleaned.replace(/<div[^>]*(author|byline|writer|post-author|entry-author|article-author|author-box|author-info|author-meta|author-bio|author-avatar|author-image|author-picture|author-photo|post-meta|entry-meta)[^>]*>[\s\S]*?<\/div>/gi, '');
    cleaned = cleaned.replace(/<section[^>]*(author|byline|writer|post-author|entry-author|article-author|author-box|author-info|author-meta|author-bio|post-meta|entry-meta)[^>]*>[\s\S]*?<\/section>/gi, '');
    cleaned = cleaned.replace(/<div[^>]*class="[^"]*(author|byline|writer|post-meta|entry-meta)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    cleaned = cleaned.replace(/<p[^>]*(author|byline|writer|post-author|post-meta|entry-meta)[^>]*>[\s\S]*?<\/p>/gi, '');
    cleaned = cleaned.replace(/<span[^>]*(author|byline|writer|post-author|post-meta|entry-meta)[^>]*>[\s\S]*?<\/span>/gi, '');
    
    // Remove author images specifically
    cleaned = cleaned.replace(/<img[^>]*(author|byline|writer|avatar|profile)[^>]*>/gi, '');
    
    // 4. Remove Related Topics div and everything after it
    // Find "Related Topics" or similar patterns and remove everything from that point forward
    const relatedTopicsPatterns = [
      /<div[^>]*(related|related-topics|related-posts|related-articles|more-stories|you-may-also-like|recommended|similar)[^>]*>[\s\S]*$/i,
      /<section[^>]*(related|related-topics|related-posts|related-articles|more-stories|you-may-also-like|recommended|similar)[^>]*>[\s\S]*$/i,
      /<h[2-6][^>]*>[\s]*Related[\s\S]*?<\/h[2-6]>[\s\S]*$/i,
      /Related Topics[\s\S]*$/i,
      /Related Posts[\s\S]*$/i,
    ];
    
    for (const pattern of relatedTopicsPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        // Remove everything from the match point forward
        cleaned = cleaned.substring(0, cleaned.indexOf(match[0]));
        break;
      }
    }
    
    // Also remove any divs/sections with "related" in class/id before the cut point
    cleaned = cleaned.replace(/<div[^>]*(related|related-topics|related-posts|related-articles|more-stories|you-may-also-like|recommended|similar)[^>]*>[\s\S]*?<\/div>/gi, '');
    cleaned = cleaned.replace(/<section[^>]*(related|related-topics|related-posts|related-articles|more-stories|you-may-also-like|recommended|similar)[^>]*>[\s\S]*?<\/section>/gi, '');
    
    // 5. Remove ALL links from content (no external links allowed)
    // First, remove all anchor tags but keep the text content
    cleaned = cleaned.replace(/<a[^>]*href=["'][^"']*["'][^>]*>([\s\S]*?)<\/a>/gi, function(match, linkText) {
      // Remove any URLs from the link text itself
      const cleanedText = linkText.replace(/https?:\/\/[^\s<>"']+/gi, '');
      return cleanedText.trim();
    });
    cleaned = cleaned.replace(/<a[^>]*href=["'][^"']*["'][^>]*\/>/gi, ''); // Remove self-closing links
    
    // Remove any remaining link-like patterns (bare URLs in text)
    cleaned = cleaned.replace(/https?:\/\/[^\s<>"']+/gi, ''); // Remove bare URLs
    
    // Remove duplicate images (featured/hero images that are already in header)
    cleaned = cleaned.replace(/<img[^>]*(featured|hero|main-image|header-image|article-image|wp-image-\d+)[^>]*>/gi, '');
    // Also remove images wrapped in divs with featured classes
    cleaned = cleaned.replace(/<div[^>]*(featured-image|hero-image|main-image)[^>]*>[\s\S]*?<\/div>/gi, '');
  } else {
    // For Not a Tesla App, use existing cleaning logic
    // Remove social media divs and links (comprehensive)
    cleaned = cleaned.replace(/<div[^>]*(social|share|facebook|twitter|instagram|tiktok|youtube|threads|linkedin|pinterest|reddit|snapchat|whatsapp|telegram)[^>]*>[\s\S]*?<\/div>/gi, '');
    cleaned = cleaned.replace(/<section[^>]*(social|share|facebook|twitter|instagram|tiktok|youtube|threads|linkedin|pinterest|reddit|snapchat|whatsapp|telegram)[^>]*>[\s\S]*?<\/section>/gi, '');
    cleaned = cleaned.replace(/<ul[^>]*(social|share)[^>]*>[\s\S]*?<\/ul>/gi, '');
    cleaned = cleaned.replace(/<a[^>]*(facebook|twitter|instagram|tiktok|youtube|threads|linkedin|pinterest|reddit|snapchat|whatsapp|telegram)[^>]*>[\s\S]*?<\/a>/gi, '');
    
    // Remove links to Not a Tesla App (except we'll keep the bottom attribution link separately)
    cleaned = cleaned.replace(/<a[^>]*href=["']https?:\/\/(www\.)?notateslaapp\.com[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi, '$2'); // Keep link text, remove link
    cleaned = cleaned.replace(/<a[^>]*href=["']https?:\/\/(www\.)?notateslaapp\.com[^"']*["'][^>]*\/>/gi, ''); // Remove self-closing links
    
    // Fix relative image URLs to absolute (but don't link to notateslaapp)
    cleaned = cleaned.replace(/src="\//g, 'src="https://www.notateslaapp.com/');
  }
  
  // Common cleaning for all sources
  // Remove image captions and text under images
  cleaned = cleaned.replace(/<figcaption[^>]*>[\s\S]*?<\/figcaption>/gi, '');
  cleaned = cleaned.replace(/<p[^>]*(caption|credit|source|image-text|img-caption|photo-caption)[^>]*>[\s\S]*?<\/p>/gi, '');
  cleaned = cleaned.replace(/<div[^>]*(caption|credit|source|image-text|img-caption|photo-caption)[^>]*>[\s\S]*?<\/div>/gi, '');
  cleaned = cleaned.replace(/<span[^>]*(caption|credit|source|image-text|img-caption|photo-caption)[^>]*>[\s\S]*?<\/span>/gi, '');
  
  // Remove duplicate titles and main images from content (they're already shown in header)
  cleaned = cleaned.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '');
  
  // For Teslarati, remove featured images from content (already in header)
  if (isTeslarati) {
    // Remove featured/hero/main images that might be duplicated
    cleaned = cleaned.replace(/<img[^>]*(featured|hero|main-image|header-image|article-image|wp-image-\d+)[^>]*>/gi, '');
    // Also remove images wrapped in divs with featured classes
    cleaned = cleaned.replace(/<div[^>]*(featured-image|hero-image|main-image)[^>]*>[\s\S]*?<\/div>/gi, '');
  } else {
    cleaned = cleaned.replace(/<img[^>]*(featured|hero|main-image|header-image|article-image)[^>]*>/gi, '');
  }
  
  // Fix relative image URLs to absolute for Teslarati
  if (isTeslarati) {
    cleaned = cleaned.replace(/src="\//g, 'src="https://www.teslarati.com/');
  }
  
  // Remove data attributes and excessive attributes
  cleaned = cleaned.replace(/\s+data-[^=]*="[^"]*"/gi, '');
  cleaned = cleaned.replace(/\s+on\w+="[^"]*"/gi, ''); // Remove event handlers
  
  return cleaned.trim();
}

/**
 * Convert HTML to plain text (for fallback)
 */
function htmlToText(html: string): string {
  let text = html;
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&apos;/g, "'");
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

/**
 * Extract main image from HTML content (for Teslarati articles)
 */
function extractMainImage(html: string, url: string): string | null {
  const isTeslarati = isTeslaratiUrl(url);
  
  if (!isTeslarati) {
    return null; // Only extract images for Teslarati
  }
  
  try {
    // Try to find featured/hero/main image first
    const featuredImagePatterns = [
      /<img[^>]*(featured|hero|main-image|header-image|article-image|wp-image-\d+|attachment)[^>]+src=["']([^"']+)["'][^>]*>/i,
      /<div[^>]*(featured|hero|main-image|header-image)[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*>/i,
    ];
    
    for (const pattern of featuredImagePatterns) {
      const match = html.match(pattern);
      if (match && match[2]) {
        let imgUrl = match[2];
        // Fix relative URLs
        if (imgUrl.startsWith('/')) {
          imgUrl = `https://www.teslarati.com${imgUrl}`;
        }
        // Skip data URIs and very small images
        if (!imgUrl.startsWith('data:') && !imgUrl.includes('icon') && !imgUrl.includes('avatar')) {
          return imgUrl;
        }
      }
    }
    
    // Fallback: find first large image
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const imgMatches = [...html.matchAll(imgRegex)];
    
    for (const imgMatch of imgMatches) {
      const imgTag = imgMatch[0];
      let imgSrc = imgMatch[1];
      
      // Skip logos, icons, avatars, and small images (comprehensive check)
      const lowerSrc = imgSrc.toLowerCase();
      if (
        imgSrc.startsWith('data:') ||
        lowerSrc.includes('icon') ||
        lowerSrc.includes('avatar') ||
        lowerSrc.includes('logo') ||
        lowerSrc.includes('favicon') ||
        lowerSrc.includes('transparent') ||
        lowerSrc.includes('teslarati-logo') ||
        lowerSrc.includes('brand') ||
        lowerSrc.includes('watermark')
      ) {
        continue;
      }
      
      // Fix relative URLs
      if (imgSrc.startsWith('/')) {
        imgSrc = `https://www.teslarati.com${imgSrc}`;
      }
      
      // Check image size (prefer larger images)
      const widthMatch = imgTag.match(/width=["']?(\d+)["']?/i);
      const heightMatch = imgTag.match(/height=["']?(\d+)["']?/i);
      const width = widthMatch ? parseInt(widthMatch[1]) : 0;
      const height = heightMatch ? parseInt(heightMatch[1]) : 0;
      
      // Prefer images that are at least 400x300 or larger
      if (width >= 400 || height >= 300 || (width === 0 && height === 0)) {
        return imgSrc;
      }
    }
    
    // Last resort: return first valid image (skip logos)
    for (const imgMatch of imgMatches) {
      let imgSrc = imgMatch[1];
      const lowerSrc = imgSrc.toLowerCase();
      if (
        !imgSrc.startsWith('data:') &&
        !lowerSrc.includes('icon') &&
        !lowerSrc.includes('avatar') &&
        !lowerSrc.includes('logo') &&
        !lowerSrc.includes('favicon') &&
        !lowerSrc.includes('transparent') &&
        !lowerSrc.includes('brand') &&
        !lowerSrc.includes('watermark')
      ) {
        if (imgSrc.startsWith('/')) {
          imgSrc = `https://www.teslarati.com${imgSrc}`;
        }
        return imgSrc;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting main image:', error);
    return null;
  }
}

/**
 * Scrape article content from external URL
 */
export async function scrapeArticleContent(url: string): Promise<ScrapedContent> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.notateslaapp.com/',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Extract main image from HTML (for Teslarati)
    const mainImage = extractMainImage(html, url);
    
    // Extract main content
    let rawContent = extractArticleContent(html, url);
    
    if (!rawContent || rawContent.length < 100) {
      // Fallback: try to get content from common text containers
      const textContainers = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
      if (textContainers && textContainers.length > 0) {
        rawContent = textContainers.slice(0, 10).join(' '); // Get first 10 paragraphs
      }
    }
    
    if (!rawContent || rawContent.length < 100) {
      return {
        content: '',
        htmlContent: '',
        success: false,
        error: 'Could not extract substantial content from page',
        mainImage: mainImage || undefined,
      };
    }
    
    // Clean the HTML (pass URL for source-specific cleaning)
    let cleanedHtml = cleanHtmlContent(rawContent, url);
    
    // Replace referral links
    cleanedHtml = replaceReferralLinks(cleanedHtml);
    
    // Generate plain text version
    let plainText = htmlToText(cleanedHtml);
    
    // Replace referral links in plain text as well
    plainText = replaceReferralLinks(plainText);
    
    return {
      content: plainText,
      htmlContent: cleanedHtml,
      success: true,
      mainImage: mainImage || undefined,
    };
  } catch (error) {
    console.error('Error scraping article:', error);
    return {
      content: '',
      htmlContent: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

