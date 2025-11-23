import { MetadataRoute } from 'next';
import { adminClient } from '@/sanity/lib/adminClient';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://teslawy.com';

  try {
    // Fetch all published articles from Sanity
    const articles = await adminClient.fetch<
      Array<{
        slug: { current: string };
        publishedAt: string;
        _updatedAt: string;
      }>
    >(
      `*[_type == "article" && isPublished == true]{
        slug,
        publishedAt,
        _updatedAt
      } | order(publishedAt desc)`
    );

    console.log(`[Sitemap] Found ${articles.length} published articles`);

    // Generate sitemap entries for articles
    const articleEntries: MetadataRoute.Sitemap = articles
      .filter((article) => article.slug?.current) // Filter out articles without slugs
      .map((article) => {
        const slug = article.slug.current;
        const encodedSlug = encodeURIComponent(slug);
        return {
          url: `${siteUrl}/article/${encodedSlug}`,
          lastModified: new Date(article._updatedAt || article.publishedAt),
          changeFrequency: 'daily' as const,
          priority: 0.8,
        };
      });

    console.log(`[Sitemap] Generated ${articleEntries.length} article entries`);

    // Homepage entry
    const homepageEntry: MetadataRoute.Sitemap[0] = {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1.0,
    };

    return [homepageEntry, ...articleEntries];
  } catch (error) {
    console.error('[Sitemap] Error generating sitemap:', error);
    // Return at least homepage on error
    return [
      {
        url: siteUrl,
        lastModified: new Date(),
        changeFrequency: 'hourly',
        priority: 1.0,
      },
    ];
  }
}

