/**
 * WordPress REST API Fetcher
 * Fetches articles from WordPress websites using their native REST API
 * Converts WordPress posts to the same format as RSS articles for unified processing
 */

import { ParsedArticle } from './rss-parser';
import { slugify, generateIdFromUrl, normalizeGuid } from './utils';

interface WordPressPost {
  id: number;
  featured_media?: number;
  title: {
    rendered: string;
  };
  content: {
    rendered: string;
  };
  excerpt: {
    rendered: string;
  };
  date: string;
  date_gmt: string;
  link: string;
  author: number;
  _embedded?: {
    'wp:featuredmedia'?: Array<{
      source_url: string;
      media_details?: {
        sizes?: {
          large?: { source_url: string };
          medium_large?: { source_url: string };
          full?: { source_url: string };
        };
      };
    }>;
    author?: Array<{
      name: string;
      slug: string;
    }>;
  };
}

interface WordPressSource {
  name: string;
  baseUrl: string;
  apiUrl: string;
}

// WordPress sources configuration
const WORDPRESS_SOURCES: WordPressSource[] = [
  {
    name: 'TESLARATI',
    baseUrl: 'https://www.teslarati.com',
    apiUrl: 'https://www.teslarati.com/wp-json/wp/v2/posts',
  },
];

/**
 * Strip HTML tags from text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&amp;/g, '&') // Replace HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
}

/**
 * Extract first image from HTML content
 */
function extractFirstImageFromContent(htmlContent: string): string | null {
  try {
    // Try to extract <img> tag
    const imgMatch = htmlContent.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }
  } catch (error) {
    console.error(`[WordPress Fetcher] Error extracting image from content:`, error);
  }
  return null;
}

const featuredMediaCache = new Map<string, string>();

function getMediaCacheKey(source: WordPressSource, mediaId: number) {
  return `${source.name}-${mediaId}`;
}

async function fetchFeaturedMediaById(source: WordPressSource, mediaId: number): Promise<string | null> {
  const cacheKey = getMediaCacheKey(source, mediaId);
  if (featuredMediaCache.has(cacheKey)) {
    return featuredMediaCache.get(cacheKey)!;
  }

  try {
    const mediaEndpoint = source.apiUrl.replace(/\/posts\/?$/, '/media');
    const mediaUrl = `${mediaEndpoint}/${mediaId}?_fields=source_url,media_details`;
    console.log(`[WordPress Fetcher] Fetching featured media ${mediaId} from ${source.name}: ${mediaUrl}`);

    const response = await fetch(mediaUrl, {
      next: { revalidate: 0 },
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TeslaNewsBot/1.0)',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[WordPress Fetcher] ⚠️  Failed to fetch media ${mediaId}: HTTP ${response.status}`);
      return null;
    }

    const mediaData: {
      source_url?: string;
      media_details?: {
        sizes?: Record<string, { source_url: string }>;
      };
    } = await response.json();

    const sizes = mediaData.media_details?.sizes || {};
    const preferredOrder = ['large', 'medium_large', 'full'];

    for (const size of preferredOrder) {
      const sizeUrl = sizes[size]?.source_url;
      if (sizeUrl) {
        featuredMediaCache.set(cacheKey, sizeUrl);
        return sizeUrl;
      }
    }

    if (mediaData.source_url) {
      featuredMediaCache.set(cacheKey, mediaData.source_url);
      return mediaData.source_url;
    }

  } catch (error) {
    console.error(`[WordPress Fetcher] Error fetching media ${mediaId}:`, error);
  }

  return null;
}

/**
 * Extract featured image URL from WordPress post
 */
async function extractFeaturedImage(post: WordPressPost, source: WordPressSource): Promise<string | null> {
  try {
    // Method 1: Try embedded featured media
    if (
      post._embedded &&
      post._embedded['wp:featuredmedia'] &&
      post._embedded['wp:featuredmedia'].length > 0
    ) {
      const featuredMedia = post._embedded['wp:featuredmedia'][0];
      
      console.log(`[WordPress Fetcher] Featured media found for: ${post.title.rendered.substring(0, 50)}`);
      
      // Try to get the best quality image available
      if (featuredMedia.media_details?.sizes) {
        const sizes = featuredMedia.media_details.sizes;
        if (sizes.large?.source_url) {
          console.log(`[WordPress Fetcher] ✓ Using large image`);
          return sizes.large.source_url;
        }
        if (sizes.medium_large?.source_url) {
          console.log(`[WordPress Fetcher] ✓ Using medium_large image`);
          return sizes.medium_large.source_url;
        }
        if (sizes.full?.source_url) {
          console.log(`[WordPress Fetcher] ✓ Using full image`);
          return sizes.full.source_url;
        }
      }
      
      // Fallback to source_url
      if (featuredMedia.source_url) {
        console.log(`[WordPress Fetcher] ✓ Using source_url`);
        return featuredMedia.source_url;
      }
    }
    
    // Method 1b: Fetch media by ID if embed missing
    if (post.featured_media) {
      const fetchedMedia = await fetchFeaturedMediaById(source, post.featured_media);
      if (fetchedMedia) {
        console.log(`[WordPress Fetcher] ✓ Using fetched media by ID ${post.featured_media}`);
        return fetchedMedia;
      }
    }
    
    // Method 2: Try to extract image from content HTML
    const contentImage = extractFirstImageFromContent(post.content?.rendered || '');
    if (contentImage) {
      console.log(`[WordPress Fetcher] ✓ Using image from content`);
      return contentImage;
    }
    
    // Method 3: Try to extract image from excerpt
    const excerptImage = extractFirstImageFromContent(post.excerpt?.rendered || '');
    if (excerptImage) {
      console.log(`[WordPress Fetcher] ✓ Using image from excerpt`);
      return excerptImage;
    }
    
    console.warn(`[WordPress Fetcher] ⚠️ No image found for: ${post.title.rendered.substring(0, 50)}`);
  } catch (error) {
    console.error(`[WordPress Fetcher] Error extracting featured image:`, error);
  }
  
  return null;
}

/**
 * Convert WordPress post to ParsedArticle format (same as RSS articles)
 */
async function convertWordPressPostToArticle(post: WordPressPost, source: WordPressSource): Promise<ParsedArticle> {
  const title = stripHtml(post.title?.rendered || 'Untitled');
  const content = post.content?.rendered || '';
  const excerpt = stripHtml(post.excerpt?.rendered || '');
  const url = post.link || '';
  
  console.log(`[WordPress Fetcher] Converting post: ${title.substring(0, 50)}...`);
  const imageUrl = await extractFeaturedImage(post, source);
  console.log(`[WordPress Fetcher]   Final imageUrl: ${imageUrl ? imageUrl.substring(0, 80) + '...' : 'NULL'}`);
  
  const publishedAt = post.date || post.date_gmt || new Date().toISOString();
  
  // Generate ID and slug (same format as RSS articles)
  const id = generateIdFromUrl(url);
  const slug = slugify(title);
  const guid = normalizeGuid(url); // Use URL as GUID for WordPress posts

  return {
    id,
    slug,
    guid,
    source: {
      id: null,
      name: source.name,
    },
    author: null,
    title,
    description: excerpt.substring(0, 300), // Limit description
    url,
    urlToImage: imageUrl,
    publishedAt, // Already in ISO format from WordPress API
    content: content, // Full HTML content
  };
}

/**
 * Fetch articles from a single WordPress source
 */
async function fetchFromWordPressSource(source: WordPressSource): Promise<ParsedArticle[]> {
  try {
    const url = `${source.apiUrl}?per_page=10&_embed=wp:featuredmedia`; // Explicitly request featured media
    
    console.log(`[WordPress Fetcher] Fetching from ${source.name}: ${url}`);
    
    const response = await fetch(url, {
      next: { revalidate: 0 }, // Always fetch fresh data for cron
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TeslaNewsBot/1.0)',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const posts: WordPressPost[] = await response.json();
    
    if (!Array.isArray(posts)) {
      throw new Error('Invalid response format: expected array');
    }

    console.log(`[WordPress Fetcher] ✓ Fetched ${posts.length} posts from ${source.name}`);
    
    // Log embedded data status for debugging
    posts.forEach((post, index) => {
      const hasEmbedded = !!post._embedded;
      const hasFeaturedMedia = post._embedded?.['wp:featuredmedia']?.[0];
      console.log(`[WordPress Fetcher]   Post ${index + 1}: ${post.title.rendered.substring(0, 40)}...`);
      console.log(`[WordPress Fetcher]     - _embedded exists: ${hasEmbedded}`);
      console.log(`[WordPress Fetcher]     - featured media exists: ${!!hasFeaturedMedia}`);
      if (hasFeaturedMedia) {
        console.log(`[WordPress Fetcher]     - featured media URL: ${hasFeaturedMedia.source_url?.substring(0, 60) || 'none'}...`);
      }
    });
    
    // Convert WordPress posts to ParsedArticle format
    const articles = await Promise.all(posts.map(post => convertWordPressPostToArticle(post, source)));
    
    return articles;
  } catch (error) {
    console.error(`[WordPress Fetcher] ✗ Error fetching from ${source.name}:`, error);
    return []; // Return empty array on error
  }
}

/**
 * Fetch latest articles from all WordPress sources
 * Returns articles in the same format as RSS articles for unified processing
 */
export async function fetchWordPressArticles(): Promise<ParsedArticle[]> {
  console.log('[WordPress Fetcher] Starting to fetch articles from WordPress sources...');
  
  // Fetch from all sources concurrently using Promise.allSettled
  const results = await Promise.allSettled(
    WORDPRESS_SOURCES.map(source => fetchFromWordPressSource(source))
  );

  // Combine all successful results
  const allArticles: ParsedArticle[] = [];
  
  results.forEach((result, index) => {
    const source = WORDPRESS_SOURCES[index];
    
    if (result.status === 'fulfilled') {
      const articles = result.value;
      if (articles.length > 0) {
        console.log(`[WordPress Fetcher] ✓ Successfully fetched ${articles.length} articles from ${source.name}`);
        allArticles.push(...articles);
      } else {
        console.warn(`[WordPress Fetcher] ⚠️  No articles returned from ${source.name}`);
      }
    } else {
      console.error(`[WordPress Fetcher] ✗ Failed to fetch from ${source.name}:`, result.reason);
    }
  });

  console.log(`[WordPress Fetcher] ✓ Total WordPress articles fetched: ${allArticles.length}`);
  
  return allArticles;
}

