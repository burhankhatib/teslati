import { client } from '@/sanity/lib/client';
import { sanityFetch } from '@/sanity/lib/live';
import { urlFor } from '@/sanity/lib/image';

export interface SanityArticle {
  _id: string;
  title: string;
  titleAr: string;
  slug: {
    current: string;
  };
  description?: string;
  descriptionAr: string;
  content?: string;
  contentAr: string;
  htmlContent?: string;
  htmlContentAr?: string;
  image?: {
    asset: {
      _ref: string;
      _type: 'reference';
    };
  };
  imageUrl?: string;
  publishedAt: string;
  _createdAt?: string;
  _updatedAt?: string;
  sourceUrl: string;
  youtubeUrl?: string;
  sourceName: string;
  isPublished: boolean;
}

/**
 * Fetch all published articles from Sanity
 * Uses Sanity Live for real-time updates
 */
export async function getArticles(): Promise<SanityArticle[]> {
  // Sort by publishedAt desc (most recently published first)
  // This ensures articles are ordered by their actual publication date, not when they were added to Sanity
  const query = `*[_type == "article" && isPublished == true] | order(publishedAt desc) {
    _id,
    title,
    titleAr,
    slug,
    description,
    descriptionAr,
    content,
    contentAr,
    htmlContent,
    htmlContentAr,
    image {
      asset {
        _ref,
        _type
      }
    },
    imageUrl,
    publishedAt,
    _createdAt,
    sourceUrl,
    youtubeUrl,
    sourceName,
    isPublished
  }`;

  // Use sanityFetch for real-time updates with Sanity Live
  const { data: articles } = await sanityFetch({ 
    query,
    // Type assertion for TypeScript
  }) as { data: SanityArticle[] };
  
  // Convert Sanity image assets to URLs
  return articles.map(article => {
    if (article.image?.asset?._ref) {
      try {
        const imageUrl = urlFor(article.image).width(1600).height(900).url();
        return {
          ...article,
          imageUrl: imageUrl || article.imageUrl, // Use Sanity URL, fallback to imageUrl field
        };
      } catch (error) {
        console.warn('[getArticles] Failed to generate image URL:', error);
        return article; // Return article with original imageUrl if urlFor fails
      }
    }
    return article;
  });
}

/**
 * Fetch a single article by slug
 * Handles both encoded and decoded slugs for Arabic URLs
 * 
 * According to Sanity best practices:
 * - Always use parameterized queries ($slug)
 * - Handle encoding/decoding properly
 * - Provide clear error messages
 */
export async function getArticleBySlug(slug: string): Promise<SanityArticle | null> {
  // Safely decode slug (handles both encoded and already-decoded slugs)
  let normalizedSlug: string;
  try {
    normalizedSlug = decodeURIComponent(slug);
  } catch {
    // If decode fails, slug is already decoded
    normalizedSlug = slug;
  }
  
  const query = `*[_type == "article" && slug.current == $slug && isPublished == true][0] {
    _id,
    title,
    titleAr,
    slug,
    description,
    descriptionAr,
    content,
    contentAr,
    htmlContent,
    htmlContentAr,
    image {
      asset {
        _ref,
        _type
      }
    },
    imageUrl,
    publishedAt,
    _updatedAt,
    sourceUrl,
    youtubeUrl,
    sourceName,
    isPublished
  }`;

  try {
    console.log('[getArticleBySlug] Querying Sanity');
    console.log('[getArticleBySlug] Original slug:', slug);
    console.log('[getArticleBySlug] Normalized slug:', normalizedSlug);
    
    // Fetch with normalized slug first (using Sanity Live)
    const { data: article } = await sanityFetch({ 
      query, 
      params: { slug: normalizedSlug } 
    }) as { data: SanityArticle | null };
    
    if (article) {
      console.log('[getArticleBySlug] Article found:', article._id);
      // Convert Sanity image asset to URL
      if (article.image?.asset?._ref) {
        try {
          const imageUrl = urlFor(article.image).width(1600).height(900).url();
          article.imageUrl = imageUrl || article.imageUrl;
        } catch (error) {
          console.warn('[getArticleBySlug] Failed to generate image URL:', error);
        }
      }
      return article;
    }
    
    // If not found and slug was different, try original slug
    if (normalizedSlug !== slug) {
      console.log('[getArticleBySlug] Retrying with original slug:', slug);
      const { data: retryArticle } = await sanityFetch({ 
        query, 
        params: { slug } 
      }) as { data: SanityArticle | null };
      if (retryArticle) {
        console.log('[getArticleBySlug] Found article with original slug:', retryArticle._id);
        // Convert Sanity image asset to URL
        if (retryArticle.image?.asset?._ref) {
          try {
            const imageUrl = urlFor(retryArticle.image).width(1600).height(900).url();
            retryArticle.imageUrl = imageUrl || retryArticle.imageUrl;
          } catch (error) {
            console.warn('[getArticleBySlug] Failed to generate image URL:', error);
          }
        }
        return retryArticle;
      }
    }
    
    console.warn('[getArticleBySlug] No article found');
    console.warn('[getArticleBySlug] Tried slugs:', [normalizedSlug, slug].filter((s, i, arr) => arr.indexOf(s) === i));
    return null;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : { error: String(error) };
    
    console.error('[getArticleBySlug] GROQ query failed');
    console.error('[getArticleBySlug] Slug attempted:', normalizedSlug);
    console.error('[getArticleBySlug] Error details:', errorDetails);
    
    // Check for common Sanity errors
    if (errorMessage.includes('projectId') || errorMessage.includes('dataset')) {
      console.error('[getArticleBySlug] Configuration error - check environment variables');
    }
    if (errorMessage.includes('CORS') || errorMessage.includes('origin')) {
      console.error('[getArticleBySlug] CORS error - check Sanity CORS settings');
    }
    if (errorMessage.includes('token') || errorMessage.includes('unauthorized')) {
      console.error('[getArticleBySlug] Authentication error - check SANITY_API_TOKEN');
    }
    
    throw error; // Re-throw to be caught by getArticle
  }
}

