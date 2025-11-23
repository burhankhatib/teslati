'use client';

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import InArticleAd from './ads/InArticleAd';

interface ArticleContentProps {
  htmlContent?: string;
  fallbackText?: string;
  direction?: 'ltr' | 'rtl';
  lang?: 'ar' | 'en';
  isYouTubeVideo?: boolean; // If true, remove all images from content
}

/**
 * Clean HTML content on client side to remove unwanted elements
 * This is a final cleanup pass to ensure clean rendering
 * For Teslarati articles: removes ads, author divs, comments, and all links except bottom reference
 */
function cleanHtmlForDisplay(html: string): string {
  let cleaned = html;
  
  // Check if this is a Teslarati article
  const isTeslarati = /teslarati\.com/i.test(html) || /اقرأ المقال الأصلي على TESLARATI/i.test(html);
  
  // Remove the bottom reference link (user requested removal)
  if (isTeslarati) {
    // Remove the bottom reference link div
    cleaned = cleaned.replace(/<div[^>]*style="[^"]*margin-top: 2rem[^"]*"[^>]*>[\s\S]*?اقرأ المقال الأصلي على TESLARATI[\s\S]*?<\/div>/gi, '');
    cleaned = cleaned.replace(/<div[^>]*style="[^"]*margin-top: 2rem[^"]*"[^>]*>[\s\S]*?<\/div>/i, '');
    // Also remove any remaining reference to TESLARATI link
    cleaned = cleaned.replace(/اقرأ المقال الأصلي على TESLARATI/gi, '');
  }
  
  // Remove duplicate h1 tags (title is already in header)
  cleaned = cleaned.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '');
  
  // TESLARATI-SPECIFIC CLEANING
  if (isTeslarati) {
    // 1. Remove advertisement divs
    cleaned = cleaned.replace(/<div[^>]*(ad|advertisement|ads|advert|sponsor|promo|banner|google-ad|ad-container|ad-wrapper|ad-box|ad-unit|ad-slot|ad-placeholder|ad-label|ad-text)[^>]*>[\s\S]*?<\/div>/gi, '');
    cleaned = cleaned.replace(/<section[^>]*(ad|advertisement|ads|advert|sponsor|promo|banner|google-ad)[^>]*>[\s\S]*?<\/section>/gi, '');
    
    // 2. Remove social media links divs (X/Twitter, Facebook, etc.)
    cleaned = cleaned.replace(/<div[^>]*(social|share|facebook|twitter|instagram|tiktok|youtube|threads|linkedin|pinterest|reddit|snapchat|whatsapp|telegram|x\.com|tweet|share-button|share-buttons|social-share|social-media)[^>]*>[\s\S]*?<\/div>/gi, '');
    cleaned = cleaned.replace(/<section[^>]*(social|share|facebook|twitter|instagram|tiktok|youtube|threads|linkedin|pinterest|reddit|snapchat|whatsapp|telegram|x\.com|tweet|share-button|share-buttons|social-share|social-media)[^>]*>[\s\S]*?<\/section>/gi, '');
    cleaned = cleaned.replace(/<ul[^>]*(social|share|facebook|twitter|instagram|tiktok|youtube|threads|linkedin|pinterest|reddit|snapchat|whatsapp|telegram|x\.com|tweet|share-button|share-buttons)[^>]*>[\s\S]*?<\/ul>/gi, '');
    
    // Remove Share/Tweet specific divs and buttons
    cleaned = cleaned.replace(/<div[^>]*(share|tweet|share-this|share-post|share-article)[^>]*>[\s\S]*?<\/div>/gi, '');
    cleaned = cleaned.replace(/<button[^>]*(share|tweet|facebook|twitter|x\.com)[^>]*>[\s\S]*?<\/button>/gi, '');
    
    // 3. Remove author info divs (comprehensive)
    cleaned = cleaned.replace(/<div[^>]*(author|byline|writer|post-author|entry-author|article-author|author-box|author-info|author-meta|author-bio|author-avatar|author-image|author-picture|author-photo|post-meta|entry-meta)[^>]*>[\s\S]*?<\/div>/gi, '');
    cleaned = cleaned.replace(/<section[^>]*(author|byline|writer|post-author|entry-author|article-author|author-box|author-info|author-meta|author-bio|post-meta|entry-meta)[^>]*>[\s\S]*?<\/section>/gi, '');
    cleaned = cleaned.replace(/<p[^>]*(author|byline|writer|post-author|post-meta|entry-meta)[^>]*>[\s\S]*?<\/p>/gi, '');
    cleaned = cleaned.replace(/<span[^>]*(author|byline|writer|post-author|post-meta|entry-meta)[^>]*>[\s\S]*?<\/span>/gi, '');
    cleaned = cleaned.replace(/<img[^>]*(author|byline|writer|avatar|profile)[^>]*>/gi, '');
    
    // 4. Remove Related Topics div and everything after it
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
        cleaned = cleaned.substring(0, cleaned.indexOf(match[0]));
        break;
      }
    }
    
    // Also remove any divs/sections with "related" in class/id
    cleaned = cleaned.replace(/<div[^>]*(related|related-topics|related-posts|related-articles|more-stories|you-may-also-like|recommended|similar)[^>]*>[\s\S]*?<\/div>/gi, '');
    cleaned = cleaned.replace(/<section[^>]*(related|related-topics|related-posts|related-articles|more-stories|you-may-also-like|recommended|similar)[^>]*>[\s\S]*?<\/section>/gi, '');
    
    // 5. Remove ALL links (no external links allowed)
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
    cleaned = cleaned.replace(/<div[^>]*(featured-image|hero-image|main-image)[^>]*>[\s\S]*?<\/div>/gi, '');
  } else {
    // For Not a Tesla App, use existing cleaning logic
    // Remove social media divs
    cleaned = cleaned.replace(/<div[^>]*(social|share|facebook|twitter|instagram|tiktok|youtube|threads|linkedin|pinterest|reddit|snapchat|whatsapp|telegram)[^>]*>[\s\S]*?<\/div>/gi, '');
    cleaned = cleaned.replace(/<section[^>]*(social|share|facebook|twitter|instagram|tiktok|youtube|threads|linkedin|pinterest|reddit|snapchat|whatsapp|telegram)[^>]*>[\s\S]*?<\/section>/gi, '');
    cleaned = cleaned.replace(/<ul[^>]*(social|share)[^>]*>[\s\S]*?<\/ul>/gi, '');
    cleaned = cleaned.replace(/<a[^>]*(facebook|twitter|instagram|tiktok|youtube|threads|linkedin|pinterest|reddit|snapchat|whatsapp|telegram)[^>]*>[\s\S]*?<\/a>/gi, '');
    
    // Remove links to Not a Tesla App (except bottom attribution which is handled separately)
    cleaned = cleaned.replace(/<a[^>]*href=["']https?:\/\/(www\.)?notateslaapp\.com[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi, '$2');
    cleaned = cleaned.replace(/<a[^>]*href=["']https?:\/\/(www\.)?notateslaapp\.com[^"']*["'][^>]*\/>/gi, '');
    
    // Remove "Not a Tesla App" text mentions (but keep content)
    cleaned = cleaned.replace(/<[^>]*>[\s]*Not a Tesla App[\s]*<\/[^>]*>/gi, '');
    cleaned = cleaned.replace(/Not a Tesla App/gi, '');
  }
  
  // Common cleaning for all sources
  // Remove image captions and text under images
  cleaned = cleaned.replace(/<figcaption[^>]*>[\s\S]*?<\/figcaption>/gi, '');
  cleaned = cleaned.replace(/<p[^>]*(caption|credit|source|image-text|img-caption|photo-caption)[^>]*>[\s\S]*?<\/p>/gi, '');
  cleaned = cleaned.replace(/<div[^>]*(caption|credit|source|image-text|img-caption|photo-caption)[^>]*>[\s\S]*?<\/div>/gi, '');
  cleaned = cleaned.replace(/<span[^>]*(caption|credit|source|image-text|img-caption|photo-caption)[^>]*>[\s\S]*?<\/span>/gi, '');
  
  return cleaned.trim();
}

/**
 * Injects ad placeholders into HTML content after every 3 paragraphs
 * Returns array of HTML chunks and ad positions
 */
function injectAdPlaceholders(html: string): Array<{ type: 'html' | 'ad'; content: string }> {
  const result: Array<{ type: 'html' | 'ad'; content: string }> = [];
  
  // Split HTML by paragraph tags
  const paragraphRegex = /(<p[^>]*>[\s\S]*?<\/p>)/gi;
  const parts: string[] = [];
  let lastIndex = 0;
  let match;
  let paragraphCount = 0;
  
  while ((match = paragraphRegex.exec(html)) !== null) {
    // Add content before this paragraph
    if (match.index > lastIndex) {
      parts.push(html.substring(lastIndex, match.index));
    }
    parts.push(match[0]);
    lastIndex = match.index + match[0].length;
    paragraphCount++;
  }
  
  // Add remaining content
  if (lastIndex < html.length) {
    parts.push(html.substring(lastIndex));
  }
  
  // Group paragraphs and insert ads
  let currentChunk = '';
  let currentParagraphCount = 0;
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isParagraph = /<p[^>]*>[\s\S]*?<\/p>/i.test(part);
    
    if (isParagraph) {
      currentChunk += part;
      currentParagraphCount++;
      
      // Insert ad after every 3 paragraphs
      if (currentParagraphCount >= 3) {
        if (currentChunk.trim()) {
          result.push({ type: 'html', content: currentChunk });
        }
        result.push({ type: 'ad', content: 'ad-placeholder' });
        currentChunk = '';
        currentParagraphCount = 0;
      }
    } else {
      currentChunk += part;
    }
  }
  
  // Add remaining content
  if (currentChunk.trim()) {
    result.push({ type: 'html', content: currentChunk });
  }
  
  // If no paragraphs found, return original HTML
  if (result.length === 0) {
    return [{ type: 'html', content: html }];
  }
  
  return result;
}

/**
 * Safely renders HTML content from scraped articles
 * Applies final cleanup to remove unwanted elements
 */
export default function ArticleContent({
  htmlContent,
  fallbackText,
  direction = 'rtl',
  lang = 'ar',
  isYouTubeVideo = false,
}: ArticleContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  
  const baseStyle: CSSProperties = {
    direction,
    textAlign: direction === 'rtl' ? 'right' : 'left',
    unicodeBidi: 'plaintext',
  };


  // Permanently disable all interactions on images to prevent lag
  useEffect(() => {
    if (!contentRef.current) return;

    const disableImageInteractions = () => {
      const images = contentRef.current?.querySelectorAll('img');
      if (!images) return;

      images.forEach((img) => {
        // Disable all pointer interactions
        img.style.pointerEvents = 'none';
        img.style.userSelect = 'none';
        img.style.touchAction = 'none';
        img.style.cursor = 'default';
        // Prevent any hover effects
        img.style.filter = 'none';
        img.style.transition = 'none';
        img.style.transform = 'none';
        // Set as non-interactive
        img.setAttribute('draggable', 'false');
      });
    };

    // Run immediately
    disableImageInteractions();

    // Also run after a short delay to catch dynamically loaded images
    const timeout = setTimeout(disableImageInteractions, 100);

    // Use MutationObserver to catch any images added later
    const observer = new MutationObserver(disableImageInteractions);
    observer.observe(contentRef.current, {
      childList: true,
      subtree: true,
    });

    return () => {
      clearTimeout(timeout);
      observer.disconnect();
    };
  }, [htmlContent]);

  if (!htmlContent && fallbackText) {
    return (
      <div
        className="article-content max-w-none rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
        dir={direction}
        lang={lang}
        style={baseStyle}
      >
        <p className="text-lg leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
          {fallbackText}
        </p>
      </div>
    );
  }

  if (!htmlContent) {
    return null;
  }

  // Clean HTML before rendering
  let cleanedHtml = cleanHtmlForDisplay(htmlContent);
  
  // If this is a YouTube video post, remove all images from content
  if (isYouTubeVideo) {
    // Remove all img tags
    cleanedHtml = cleanedHtml.replace(/<img[^>]*>/gi, '');
    // Remove image containers/wrappers
    cleanedHtml = cleanedHtml.replace(/<div[^>]*(image|img|photo|picture|thumbnail|featured)[^>]*>[\s\S]*?<\/div>/gi, '');
    cleanedHtml = cleanedHtml.replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '');
    cleanedHtml = cleanedHtml.replace(/<picture[^>]*>[\s\S]*?<\/picture>/gi, '');
  }
  
  // Inject ad placeholders
  const contentWithAds = injectAdPlaceholders(cleanedHtml);

  return (
    <div
      ref={contentRef}
      className="article-content max-w-none"
      dir={direction}
      lang={lang}
      style={{
        ...baseStyle,
        maxWidth: '100%',
      }}
    >
      {contentWithAds.map((item, index) => {
        if (item.type === 'ad') {
          return <InArticleAd key={`ad-${index}`} />;
        }
        
        // Remove YouTube embeds from HTML (they're displayed separately from youtubeUrl field)
        const htmlContent = item.content.replace(
          /<div[^>]*class="youtube-embed-minimal"[^>]*>[\s\S]*?<\/div>/gi,
          ''
        );
        
        return (
          <div
            key={`html-${index}`}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        );
      })}
    </div>
  );
}

