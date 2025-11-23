'use server';

/**
 * Server Action to fetch latest Tesla news from WordPress websites
 * Uses WordPress REST API (wp-json/wp/v2/posts) instead of RSS feeds
 * 
 * This provides:
 * - Full article content (not just excerpts)
 * - Featured images via _embed parameter
 * - Better structured data
 * - More reliable than RSS parsing
 */

export interface NewsItem {
  id: number;
  title: string;
  summary: string; // Stripped HTML, plain text summary
  content: string; // Full HTML content
  imageUrl: string | null;
  source: string; // Website name (e.g., "Electrek", "Teslarati")
  publishedAt: string; // ISO 8601 date string
  author: string; // Author name
  url: string; // Original article URL
}

interface WordPressPost {
  id: number;
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
    name: 'Electrek',
    baseUrl: 'https://electrek.co',
    apiUrl: 'https://electrek.co/wp-json/wp/v2/posts',
  },
  {
    name: 'Teslarati',
    baseUrl: 'https://www.teslarati.com',
    apiUrl: 'https://www.teslarati.com/wp-json/wp/v2/posts',
  },
  {
    name: 'Tesla North',
    baseUrl: 'https://teslanorth.com',
    apiUrl: 'https://teslanorth.com/wp-json/wp/v2/posts',
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
 * Extract featured image URL from WordPress post
 * Safely handles nested _embedded structure
 */
function extractFeaturedImage(post: WordPressPost): string | null {
  try {
    // Check if _embedded exists and has featured media
    if (
      post._embedded &&
      post._embedded['wp:featuredmedia'] &&
      post._embedded['wp:featuredmedia'].length > 0
    ) {
      const featuredMedia = post._embedded['wp:featuredmedia'][0];
      
      // Try to get the best quality image available
      if (featuredMedia.media_details?.sizes) {
        const sizes = featuredMedia.media_details.sizes;
        // Prefer large > medium_large > full > source_url
        if (sizes.large?.source_url) {
          return sizes.large.source_url;
        }
        if (sizes.medium_large?.source_url) {
          return sizes.medium_large.source_url;
        }
        if (sizes.full?.source_url) {
          return sizes.full.source_url;
        }
      }
      
      // Fallback to source_url
      if (featuredMedia.source_url) {
        return featuredMedia.source_url;
      }
    }
  } catch (error) {
    console.error(`[WordPress API] Error extracting featured image:`, error);
  }
  
  return null;
}

/**
 * Extract author name from WordPress post
 */
function extractAuthor(post: WordPressPost): string {
  try {
    if (
      post._embedded &&
      post._embedded.author &&
      post._embedded.author.length > 0
    ) {
      return post._embedded.author[0].name || 'Unknown';
    }
  } catch (error) {
    console.error(`[WordPress API] Error extracting author:`, error);
  }
  
  return 'Unknown';
}

/**
 * Transform WordPress post to NewsItem
 */
function transformPost(post: WordPressPost, source: string): NewsItem {
  const summary = stripHtml(post.excerpt?.rendered || post.content?.rendered || '');
  const content = post.content?.rendered || '';
  const imageUrl = extractFeaturedImage(post);
  const author = extractAuthor(post);
  
  return {
    id: post.id,
    title: stripHtml(post.title?.rendered || 'Untitled'),
    summary: summary.substring(0, 200), // Limit summary to 200 chars
    content: content,
    imageUrl: imageUrl,
    source: source,
    publishedAt: post.date || post.date_gmt || new Date().toISOString(),
    author: author,
    url: post.link || '',
  };
}

/**
 * Fetch latest news from a single WordPress source
 */
async function fetchFromSource(source: WordPressSource): Promise<NewsItem[]> {
  try {
    const url = `${source.apiUrl}?per_page=5&_embed`;
    
    console.log(`[WordPress API] Fetching from ${source.name}: ${url}`);
    
    const response = await fetch(url, {
      next: { revalidate: 300 }, // Cache for 5 minutes
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

    console.log(`[WordPress API] ✓ Fetched ${posts.length} posts from ${source.name}`);
    
    // Transform posts to NewsItem format
    return posts.map(post => transformPost(post, source.name));
  } catch (error) {
    console.error(`[WordPress API] ✗ Error fetching from ${source.name}:`, error);
    // Return empty array on error (will be handled by Promise.allSettled)
    return [];
  }
}

/**
 * Fetch latest Tesla news from WordPress websites
 * Uses Promise.allSettled to handle failures gracefully
 * 
 * @returns Array of NewsItem objects from all sources
 */
export async function fetchLatestNews(): Promise<NewsItem[]> {
  console.log('[WordPress API] Starting to fetch news from WordPress sources...');
  
  // Fetch from all sources concurrently using Promise.allSettled
  // This ensures that if one source fails, others still work
  const results = await Promise.allSettled(
    WORDPRESS_SOURCES.map(source => fetchFromSource(source))
  );

  // Combine all successful results
  const allNews: NewsItem[] = [];
  
  results.forEach((result, index) => {
    const source = WORDPRESS_SOURCES[index];
    
    if (result.status === 'fulfilled') {
      const newsItems = result.value;
      if (newsItems.length > 0) {
        console.log(`[WordPress API] ✓ Successfully fetched ${newsItems.length} items from ${source.name}`);
        allNews.push(...newsItems);
      } else {
        console.warn(`[WordPress API] ⚠️  No items returned from ${source.name}`);
      }
    } else {
      console.error(`[WordPress API] ✗ Failed to fetch from ${source.name}:`, result.reason);
    }
  });

  // Sort by published date (most recent first)
  allNews.sort((a, b) => {
    const dateA = new Date(a.publishedAt).getTime();
    const dateB = new Date(b.publishedAt).getTime();
    return dateB - dateA; // Descending order
  });

  console.log(`[WordPress API] ✓ Total news items fetched: ${allNews.length}`);
  
  return allNews;
}

