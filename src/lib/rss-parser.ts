import { slugify, generateIdFromUrl, convertRSSDateToSanityDateTime } from './utils';

/**
 * Extract all images from HTML content (for AI generation)
 * @param htmlContent - HTML content to extract images from
 * @param baseUrl - Optional base URL for resolving relative image URLs
 */
export function extractAllImages(htmlContent: string, baseUrl?: string): string[] {
  if (!htmlContent) return [];
  
  const images: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const imgMatches = [...htmlContent.matchAll(imgRegex)];
  
  // Extract base URL from baseUrl parameter or try to infer from content
  let baseDomain = baseUrl;
  if (!baseDomain && htmlContent) {
    // Try to extract domain from URLs in content
    const urlMatch = htmlContent.match(/https?:\/\/([^\/\s"']+)/i);
    if (urlMatch) {
      baseDomain = `https://${urlMatch[1]}`;
    }
  }
  
  for (const imgMatch of imgMatches) {
    let imgSrc = imgMatch[1];
    const lowerSrc = imgSrc.toLowerCase();
    
    // Skip logos, icons, avatars, and small images
    if (
      imgSrc.startsWith('data:') ||
      lowerSrc.includes('icon') ||
      lowerSrc.includes('avatar') ||
      lowerSrc.includes('logo') ||
      lowerSrc.includes('favicon') ||
      lowerSrc.includes('transparent') ||
      lowerSrc.includes('teslarati-logo') ||
      lowerSrc.includes('brand') ||
      lowerSrc.includes('watermark') ||
      lowerSrc.includes('placeholder')
    ) {
      continue;
    }
    
    // Fix relative URLs - try to resolve to absolute URL
    if (imgSrc.startsWith('/')) {
      if (baseDomain) {
        try {
          const urlObj = new URL(baseDomain);
          imgSrc = `${urlObj.protocol}//${urlObj.host}${imgSrc}`;
        } catch {
          imgSrc = `${baseDomain}${imgSrc}`;
        }
      } else {
        // Try common domains as fallback
        const commonDomains = [
          'https://www.teslarati.com',
          'https://www.notateslaapp.com',
          'https://electrek.co',
          'https://cleantechnica.com',
        ];
        imgSrc = `${commonDomains[0]}${imgSrc}`;
      }
    } else if (imgSrc.startsWith('//')) {
      // Protocol-relative URL
      imgSrc = `https:${imgSrc}`;
    } else if (!imgSrc.startsWith('http')) {
      // Relative path without leading slash
      if (baseDomain) {
        try {
          const urlObj = new URL(baseDomain);
          imgSrc = `${urlObj.protocol}//${urlObj.host}/${imgSrc}`;
        } catch {
          imgSrc = `${baseDomain}/${imgSrc}`;
        }
      }
    }
    
    // Only add if not already in the list and is a valid URL
    if (imgSrc.startsWith('http') && !images.includes(imgSrc)) {
      images.push(imgSrc);
    }
  }
  
  return images;
}

/**
 * Extract plain text from HTML (for AI generation)
 * Also removes "Related News", "More News", and source mentions
 */
export function extractPlainText(htmlContent: string): string {
  let text = htmlContent;
  
  // Remove "Related News" or "More News" sections
  const relatedNewsPatterns = [
    /<div[^>]*(related|related-news|more-news|more-stories|you-may-also-like|recommended|similar)[^>]*>[\s\S]*$/i,
    /<section[^>]*(related|related-news|more-news|more-stories|you-may-also-like|recommended|similar)[^>]*>[\s\S]*$/i,
    /<h[2-6][^>]*>[\s]*(Related|More News|Related News|More Stories|You May Also Like)[\s\S]*?<\/h[2-6]>[\s\S]*$/i,
    /Related News[\s\S]*$/i,
    /More News[\s\S]*$/i,
    /Related Stories[\s\S]*$/i,
  ];
  
  for (const pattern of relatedNewsPatterns) {
    const match = text.match(pattern);
    if (match) {
      text = text.substring(0, text.indexOf(match[0]));
      break;
    }
  }
  
  // Remove source mentions (Teslarati, Not a Tesla App)
  text = text.replace(/Teslarati/gi, '');
  text = text.replace(/Not a Tesla App/gi, '');
  text = text.replace(/teslarati\.com/gi, '');
  text = text.replace(/notateslaapp\.com/gi, '');
  
  // Remove script and style tags
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remove HTML tags but keep line breaks
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<[^>]+>/g, '');
  
  // Clean up whitespace
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');
  
  return text.trim();
}

export interface ParsedArticle {
  id: string;
  slug: string;
  guid?: string; // RSS GUID for duplicate detection
  source: {
    id: string | null;
    name: string;
  };
  author: string | null;
  title: string;
  description: string;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string;
}

export interface RSSFeedConfig {
  url: string;
  sourceName: string;
  pages?: number; // Number of pages to fetch (for WordPress RSS feeds with pagination)
  filterKeywords?: string[]; // Optional: Filter articles by keywords (must contain at least one)
  requireAllKeywords?: boolean; // Optional: Require all keywords instead of any
}

// RSS Feed Sources Configuration
// Easy to add new feeds: just add a new entry with url and sourceName
export const RSS_FEEDS: RSSFeedConfig[] = [
  {
    url: 'https://www.notateslaapp.com/rss',
    sourceName: 'Not a Tesla App',
    // No filtering needed - already Tesla-focused
  },
  {
    url: 'https://www.teslarati.com/category/tesla/feed/',
    sourceName: 'TESLARATI',
    // WordPress feeds don't support pagination via paged parameter - fetch single feed
    // No filtering needed - already Tesla-focused
  },
];

/**
 * Check if article content matches filter keywords
 * @param article - The article to check
 * @param filterKeywords - Array of keywords to check (case-insensitive)
 * @param requireAll - If true, requires all keywords; if false, requires at least one
 * @returns true if article matches filter criteria
 */
function matchesKeywordFilter(
  article: { title: string; description: string; content: string },
  filterKeywords?: string[],
  requireAll: boolean = false
): boolean {
  // If no filter, accept all articles
  if (!filterKeywords || filterKeywords.length === 0) {
    return true;
  }

  // Combine title, description, and content for searching
  const searchText = `${article.title} ${article.description} ${article.content}`.toLowerCase();

  if (requireAll) {
    // All keywords must be present
    return filterKeywords.every((keyword) =>
      searchText.includes(keyword.toLowerCase())
    );
  } else {
    // At least one keyword must be present
    return filterKeywords.some((keyword) =>
      searchText.includes(keyword.toLowerCase())
    );
  }
}

export function parseRSSFeed(
  xmlText: string,
  sourceName: string = 'Not a Tesla App',
  filterKeywords?: string[],
  requireAllKeywords: boolean = false
): ParsedArticle[] {
  const articles: ParsedArticle[] = [];
  let filteredCount = 0;
  
  // Enhanced regex to properly extract each <item> separately
  // Use non-greedy matching and ensure we capture complete items
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  const items: string[] = [];
  
  // Extract all items using exec to get proper matches
  while ((match = itemRegex.exec(xmlText)) !== null) {
    items.push(match[1]);
  }
  
  console.log(`[RSS Parser] Found ${items.length} items in RSS feed from ${sourceName}`);
  
  items.forEach((itemXml, index) => {
    const getTagContent = (tag: string, namespace?: string): string => {
      const tagName = namespace ? `${namespace}:${tag}` : tag;
      // Enhanced regex to match tag with optional attributes
      const regex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
      const match = itemXml.match(regex);
      if (!match) return '';
      
      let content = match[1];
      // Remove CDATA wrapper if present
      content = content.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
      // Remove HTML tags from description (but keep content:encoded as HTML)
      if (tag === 'description' && !namespace) {
        content = content.replace(/<[^>]*>/g, '').trim();
      }
      return content.trim();
    };
    
    const getGuid = (): string | null => {
      // Try guid tag (can be isPermaLink="false" or "true")
      const guidMatch = itemXml.match(/<guid(?:\s[^>]*)?>([\s\S]*?)<\/guid>/i);
      if (guidMatch) {
        return guidMatch[1].trim().replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
      }
      return null;
    };
    
    const getMediaContent = (): string | null => {
      // Try media:content first (for Not a Tesla App)
      let regex = /<media:content[^>]*url=["']([^"']+)["'][^>]*>/i;
      let match = itemXml.match(regex);
      if (match) return match[1];
      
      // Try content:encoded for Teslarati (images might be in HTML content)
      const contentEncoded = getTagContent('encoded', 'content');
      if (contentEncoded) {
        // Extract images from content:encoded
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
        const imgMatches = [...contentEncoded.matchAll(imgRegex)];
        
        if (imgMatches.length > 0) {
          // For Teslarati, prefer featured/hero/main images, then larger images
          let bestImage: string | null = null;
          let bestImageSize = 0;
          
          for (const imgMatch of imgMatches) {
            const imgTag = imgMatch[0];
            const imgSrc = imgMatch[1];
            
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
            
            // Check if this is a featured/hero/main image (prioritize these)
            if (imgTag.match(/(featured|hero|main-image|header-image|article-image|wp-image-\d+|attachment)/i)) {
              // Double-check it's not a logo even if it has featured class
              if (!lowerSrc.includes('logo') && !lowerSrc.includes('brand')) {
                bestImage = imgSrc;
                break; // Found featured image, use it
              }
            }
            
            // Extract width/height if available to prefer larger images
            const widthMatch = imgTag.match(/width=["']?(\d+)["']?/i);
            const heightMatch = imgTag.match(/height=["']?(\d+)["']?/i);
            const width = widthMatch ? parseInt(widthMatch[1]) : 0;
            const height = heightMatch ? parseInt(heightMatch[1]) : 0;
            const size = width * height;
            
            // Prefer images that are at least 400x300 or larger (skip small logos)
            // Also check filename doesn't contain "logo"
            if (
              size > bestImageSize &&
              (width >= 400 || height >= 300) &&
              !lowerSrc.includes('logo') &&
              !lowerSrc.includes('brand')
            ) {
              bestImage = imgSrc;
              bestImageSize = size;
            }
          }
          
          // If we found a good image, return it
          if (bestImage) {
            // Fix relative URLs
            if (bestImage.startsWith('/')) {
              bestImage = `https://www.teslarati.com${bestImage}`;
            }
            return bestImage;
          }
          
          // Fallback: return first image that's not a logo/icon/avatar
          for (const imgMatch of imgMatches) {
            const imgSrc = imgMatch[1];
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
              // Fix relative URLs
              if (imgSrc.startsWith('/')) {
                return `https://www.teslarati.com${imgSrc}`;
              }
              return imgSrc;
            }
          }
        }
      }
      
      // Try enclosure tag
      regex = /<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image[^"']*["'][^>]*>/i;
      match = itemXml.match(regex);
      if (match) return match[1];
      
      return null;
    };
    
    const title = getTagContent('title');
    const link = getTagContent('link');
    const pubDate = getTagContent('pubDate');
    
    // Enhanced logging for date parsing (especially for "Not a Tesla App")
    if (sourceName === 'Not a Tesla App' && pubDate) {
      console.log(`[RSS Parser] 📅 Raw pubDate from RSS: "${pubDate}"`);
      const parsedDate = convertRSSDateToSanityDateTime(pubDate);
      const dateObj = new Date(pubDate);
      console.log(`[RSS Parser]   Parsed Date Object: ${dateObj.toString()}`);
      console.log(`[RSS Parser]   UTC String: ${dateObj.toUTCString()}`);
      console.log(`[RSS Parser]   ISO String: ${dateObj.toISOString()}`);
      console.log(`[RSS Parser]   Converted to Sanity format: ${parsedDate}`);
      console.log(`[RSS Parser]   Timezone offset: ${dateObj.getTimezoneOffset()} minutes`);
      console.log(`[RSS Parser]   Local time: ${dateObj.toLocaleString()}`);
      console.log(`[RSS Parser]   UTC time: ${dateObj.toUTCString()}`);
    }
    const description = getTagContent('description');
    const contentEncoded = getTagContent('encoded', 'content'); // For Teslarati full content
    const guid = getGuid();
    const urlToImage = getMediaContent();
    
    // Validate that we have at least title and link (required fields)
    if (!title || !link) {
      console.warn(`[RSS Parser] Skipping item ${index + 1} - missing title or link`);
      return;
    }
    
    // Use GUID if available, otherwise generate from URL
    const id = guid ? generateIdFromUrl(guid) : generateIdFromUrl(link);
    const slug = slugify(title);
    
    // For Teslarati: use content:encoded (full HTML content)
    // For Not a Tesla App: use description or content:encoded
    const content = contentEncoded || description || '';
    
    // Clean description (remove HTML tags)
    let cleanDescription = description || '';
    cleanDescription = cleanDescription.replace(/<[^>]*>/g, '').trim();
    // Remove "The post ... appeared first on ..." text from description
    cleanDescription = cleanDescription.replace(/The post .* appeared first on .*\./i, '').trim();
    
    // Create article object for filtering
    const article = {
      id,
      slug,
      guid: guid || link, // Use GUID if available, otherwise use URL
      source: {
        id: null,
        name: sourceName,
      },
      author: null,
      title,
      description: cleanDescription,
      url: link,
      urlToImage,
      publishedAt: pubDate ? convertRSSDateToSanityDateTime(pubDate) : new Date().toISOString(),
      content: content,
    };

    // Apply keyword filter if specified
    // For "Not a Tesla App", no filter is needed (filterKeywords is undefined)
    const shouldInclude = matchesKeywordFilter(article, filterKeywords, requireAllKeywords);
    
    if (shouldInclude) {
      articles.push(article);
      const parsedDate = pubDate ? convertRSSDateToSanityDateTime(pubDate) : new Date().toISOString();
      console.log(`[RSS Parser] ✓ Article ${index + 1}: "${title.substring(0, 50)}..." (${pubDate || 'no date'} → ${parsedDate})`);
    } else {
      filteredCount++;
      console.log(`[RSS Parser] ✗ Filtered out: "${title.substring(0, 50)}..." (no Tesla keywords)`);
      console.log(`[RSS Parser]   Filter keywords: ${filterKeywords ? filterKeywords.join(', ') : 'none (all articles included)'}`);
      console.log(`[RSS Parser]   Article title: "${title}"`);
      console.log(`[RSS Parser]   Article description: "${description.substring(0, 100)}..."`);
    }
  });
  
  if (filteredCount > 0) {
    console.log(`[RSS Parser] Filtered out ${filteredCount} non-Tesla articles from ${sourceName}`);
  }
  console.log(`[RSS Parser] Successfully parsed ${articles.length} articles from ${sourceName}`);
  
  return articles;
}

export async function fetchRSSFeed(): Promise<ParsedArticle[]> {
  const allArticles: ParsedArticle[] = [];
  
  // Fetch from all configured RSS feeds
  for (const feedConfig of RSS_FEEDS) {
    try {
      const pagesToFetch = feedConfig.pages || 1; // Default to 1 page if not specified
      console.log(`[RSS Parser] Fetching from ${feedConfig.sourceName}: ${feedConfig.url}`);
      
      // Fetch feed (WordPress feeds don't support pagination via URL parameters)
      // Each feed URL returns the latest articles - WordPress handles pagination internally
      try {
        console.log(`[RSS Parser] Fetching from ${feedConfig.sourceName}...`);
        
        const response = await fetch(feedConfig.url, {
          next: { revalidate: 0 }, // Always fetch fresh data for cron
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; TeslaNewsBot/1.0)',
            'Accept': 'application/rss+xml, application/xml, text/xml',
          },
        });
        
        if (!response.ok) {
          console.error(`[RSS Parser] Failed to fetch ${feedConfig.url}: ${response.status} ${response.statusText}`);
          continue; // Skip this feed and continue with others
        }
        
        const xmlText = await response.text();
        
        // Check if we got valid XML
        if (!xmlText || xmlText.trim().length === 0) {
          console.error(`[RSS Parser] Empty response from ${feedConfig.sourceName}`);
          continue;
        }
        
        const articles = parseRSSFeed(
          xmlText,
          feedConfig.sourceName,
          feedConfig.filterKeywords,
          feedConfig.requireAllKeywords
        );
        
        console.log(`[RSS Parser] ✓ Found ${articles.length} articles from ${feedConfig.sourceName}`);
        
        // Log first 5 articles with their dates for debugging
        if (articles.length > 0) {
          console.log(`[RSS Parser] Latest articles from ${feedConfig.sourceName}:`);
          articles.slice(0, 5).forEach((article, idx) => {
            const pubDate = new Date(article.publishedAt);
            const dateStr = pubDate.toISOString().split('T')[0];
            console.log(`[RSS Parser]   ${idx + 1}. "${article.title.substring(0, 60)}..." (${dateStr})`);
          });
        } else {
          console.warn(`[RSS Parser] ⚠️  No articles found from ${feedConfig.sourceName} - check if feed is working`);
        }
        
        allArticles.push(...articles);
        
      } catch (feedError) {
        console.error(`[RSS Parser] ✗ Error fetching ${feedConfig.sourceName} (${feedConfig.url}):`, feedError);
        // Continue with other feeds even if one fails
      }
      
      // Small delay between feeds to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[RSS Parser] ✗ Error processing ${feedConfig.sourceName}:`, error);
      // Continue with other feeds even if one fails
    }
  }
  
  // Remove duplicates based on URL (same article might appear in multiple feeds)
  const uniqueArticles = new Map<string, ParsedArticle>();
  for (const article of allArticles) {
    const key = article.url;
    if (!uniqueArticles.has(key)) {
      uniqueArticles.set(key, article);
    }
  }
  
  console.log(`[RSS Parser] Total unique articles: ${uniqueArticles.size} (from ${allArticles.length} total)`);
  
  return Array.from(uniqueArticles.values());
}

