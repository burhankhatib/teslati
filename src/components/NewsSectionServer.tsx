import { getArticles } from '@/lib/sanity-queries';
import { SanityLive } from '@/sanity/lib/live';
import NewsSection from './NewsSection';

/**
 * Server component wrapper for NewsSection
 * Fetches data using sanityFetch (with Live support) and passes to client component
 * 
 * Based on official example from https://www.sanity.io/live
 * SanityLive should be in the same component that uses sanityFetch
 */
export default async function NewsSectionServer() {
  // Fetch articles using sanityFetch - this enables Live updates
  const articles = await getArticles();
  
  // Transform to match expected format
  const transformedArticles = articles.map(article => ({
    id: article._id,
    slug: article.slug.current,
    source: {
      id: null,
      name: article.sourceName,
    },
    author: null,
    title: article.titleAr || article.title || '',
    description: article.descriptionAr || article.description || '',
    url: article.sourceUrl,
    urlToImage: article.imageUrl || null,
    publishedAt: article.publishedAt,
    content: article.contentAr || article.content || '',
    htmlContent: article.htmlContentAr || article.htmlContent,
  }));

  // Pass data to client component
  // Include SanityLive in the same component that uses sanityFetch (official pattern)
  return (
    <>
      <NewsSection initialArticles={transformedArticles} />
      <SanityLive />
    </>
  );
}

