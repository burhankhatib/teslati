import { getArticles } from '@/lib/sanity-queries';
import { SanityLive } from '@/sanity/lib/live';
import HeroSection from './HeroSection';

/**
 * Server component wrapper for HeroSection
 * Fetches latest article using sanityFetch (with Live support) and passes to client component
 * 
 * Based on official example from https://www.sanity.io/live
 * SanityLive should be in the same component that uses sanityFetch
 */
export default async function HeroSectionServer() {
  // Fetch articles using sanityFetch - this enables Live updates
  const articles = await getArticles();
  
  if (!articles || articles.length === 0) {
    // Pass null if no articles available
    return (
      <>
        <HeroSection latestArticle={null} />
        <SanityLive />
      </>
    );
  }

  // Transform to match expected format
  // Articles are already sorted by publishedAt desc from getArticles() query
  const transformedArticles = articles.map(article => ({
    id: article._id,
    slug: article.slug.current,
    source: {
      id: null,
      name: article.sourceName,
    },
    title: article.titleAr || article.title || '',
    description: article.descriptionAr || article.description || '',
    url: article.sourceUrl,
    urlToImage: article.imageUrl || null,
    publishedAt: article.publishedAt,
    createdAt: article._createdAt || article.publishedAt, // Use _createdAt if available, fallback to publishedAt
  }));

  // Show the most recently published article (by publishedAt)
  // The articles array is already sorted by publishedAt desc from the query
  const latestArticle = transformedArticles[0];

  // Pass data to client component
  // Include SanityLive in the same component that uses sanityFetch (official pattern)
  return (
    <>
      <HeroSection latestArticle={latestArticle} />
      <SanityLive />
    </>
  );
}

