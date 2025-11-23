import { notFound } from 'next/navigation';
import { getArticleBySlug } from '@/lib/sanity-queries';
import { SanityLive } from '@/sanity/lib/live';
import ArticlePageClient from '@/components/ArticlePageClient';

// Force dynamic rendering - critical for Vercel deployment
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

interface Article {
  id: string;
  slug: string;
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
  updatedAt?: string;
  content: string;
  scrapedContent?: string;
  scrapedText?: string;
  youtubeUrl?: string;
  scrapingSuccess?: boolean;
  scrapingError?: string;
}

async function getArticle(slug: string): Promise<Article | null> {
  try {
    // Enhanced logging for debugging
    console.log('[getArticle] Fetching article with slug:', slug);
    console.log('[getArticle] Slug type:', typeof slug);
    console.log('[getArticle] Slug length:', slug.length);
    console.log('[getArticle] Slug encoded:', encodeURIComponent(slug));

    // Fetch from Sanity
    const sanityArticle = await getArticleBySlug(slug);

    if (!sanityArticle) {
      console.warn('[getArticle] Article not found for slug:', slug);
      console.warn('[getArticle] This could mean:');
      console.warn('  - Article does not exist in Sanity');
      console.warn('  - Article is not published (isPublished: false)');
      console.warn('  - Slug mismatch (check slug.current in Sanity)');
      return null;
    }

    console.log('[getArticle] Article found:', sanityArticle._id);

    // Transform Sanity article to match expected format
    return {
      id: sanityArticle._id,
      slug: sanityArticle.slug.current,
      source: {
        id: null,
        name: sanityArticle.sourceName,
      },
      author: null,
      title: sanityArticle.titleAr, // Arabic title (primary)
      description: sanityArticle.descriptionAr, // Arabic description (primary)
      url: sanityArticle.sourceUrl,
      urlToImage: sanityArticle.imageUrl || null,
      publishedAt: sanityArticle.publishedAt,
      updatedAt: sanityArticle._updatedAt,
      content: sanityArticle.contentAr, // Arabic content (primary)
      scrapedContent: sanityArticle.htmlContentAr, // Arabic HTML content (primary)
      scrapedText: sanityArticle.contentAr,
      youtubeUrl: sanityArticle.youtubeUrl || undefined,
      scrapingSuccess: true,
      scrapingError: undefined,
    };
  } catch (error) {
    // Enhanced error logging with slug context
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('[getArticle] ERROR fetching article from Sanity');
    console.error('[getArticle] Slug requested:', slug);
    console.error('[getArticle] Error message:', errorMessage);
    if (errorStack) {
      console.error('[getArticle] Error stack:', errorStack);
    }
    console.error('[getArticle] Full error object:', error);

    return null;
  }
}


// Prevent static generation - all routes must be dynamic
export async function generateStaticParams() {
  return []; // Empty array means no static generation
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;

  // Decode URL-encoded slug (critical for Arabic URLs)
  // Handle case where slug might already be decoded
  let slug: string;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    // If decode fails, slug is already decoded
    slug = rawSlug;
  }

  const article = await getArticle(slug);

  if (!article) {
    notFound();
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://teslawy.com';
  const articleUrl = `${siteUrl}/article/${encodeURIComponent(article.slug)}`;
  
  // Truncate headline to max 110 characters (Google News requirement)
  const headline = article.title.length > 110 
    ? article.title.substring(0, 107) + '...' 
    : article.title;
  
  // Use updatedAt if available, otherwise use publishedAt
  const dateModified = article.updatedAt || article.publishedAt;
  
  // Ensure image is an array (Google News requirement)
  const imageUrl = article.urlToImage || `${siteUrl}/og-default.jpg`;
  
  // Get description (truncate if needed)
  const description = article.description || article.content?.substring(0, 200) || '';
  
  // Author information - using site name as author since articles don't have individual authors
  const authorName = article.source?.name || 'تسلاوي';
  const authorUrl = `${siteUrl}/about`; // You can create an about page or use homepage
  
  // Publisher logo URL
  const logoUrl = `${siteUrl}/logo.svg`; // Using SVG logo from public folder

  return (
    <>
      {/* Structured Data (JSON-LD) for Google News */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: headline,
            image: [imageUrl],
            datePublished: article.publishedAt,
            dateModified: dateModified,
            author: {
              "@type": "Person",
              name: authorName,
              url: authorUrl,
            },
            publisher: {
              "@type": "Organization",
              name: "Teslawy",
              logo: {
                "@type": "ImageObject",
                url: logoUrl,
                width: 600,
                height: 60,
              },
            },
            description: description,
            mainEntityOfPage: {
              "@type": "WebPage",
              "@id": articleUrl,
            },
            articleSection: "أخبار تسلا",
            keywords: ["تسلا", "Tesla", "أخبار تسلا", "سيارات كهربائية"],
            inLanguage: "ar-SA",
          }),
        }}
      />
      <ArticlePageClient article={article} />
      {/* Sanity Live - enables real-time content updates for article pages */}
      <SanityLive />
    </>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<import('next').Metadata> {
  const { slug: rawSlug } = await params;

  // Decode URL-encoded slug (critical for Arabic URLs)
  let slug: string;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    slug = rawSlug;
  }

  const article = await getArticle(slug);

  if (!article) {
    return {
      title: 'المقال غير موجود | تسلاوي',
      description: 'المقال المطلوب غير موجود',
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://teslawy.com';
  const articleUrl = `${siteUrl}/article/${encodeURIComponent(slug)}`;
  const articleImage = article.urlToImage || `${siteUrl}/og-image.jpg`;

  // Truncate description for SEO (150-160 chars optimal)
  const description = article.description
    ? article.description.substring(0, 160).replace(/\s+/g, ' ').trim()
    : article.content?.substring(0, 160).replace(/\s+/g, ' ').trim() || '';

  return {
    title: `${article.title} | تسلاوي`,
    description,
    keywords: [
      "أخبار تسلا",
      "تسلا",
      "Tesla",
      article.title,
      "أخبار تسلا بالعربية",
      "Tesla news Arabic",
    ],
    authors: [{ name: "تسلاوي" }],
    alternates: {
      canonical: articleUrl,
    },
    openGraph: {
      type: "article",
      locale: "ar_SA",
      url: articleUrl,
      siteName: "تسلاوي",
      title: article.title,
      description,
      images: [
        {
          url: articleImage,
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
      publishedTime: article.publishedAt,
      section: "أخبار تسلا",
      tags: ["تسلا", "Tesla", "أخبار", "سيارات كهربائية"],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images: [articleImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

